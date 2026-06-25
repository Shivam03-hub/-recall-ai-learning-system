"""
API routes for meetings.
"""
from auth.dependencies import get_current_user
from db.models import User, KnowledgeFlag
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from db.models import Topic, Concept
from core.topic_matcher import suggest_topic
from schemas.topic import TopicConfirmRequest
from core.vector_store import build_vector_store
from core.extractor import extract_concepts
from core.summarizer import generate_title, summarize
from core.transcriber import transcribe_all
from db.database import get_db, SessionLocal
from db.models import Meeting
from schemas.meeting import MeetingCreateRequest, MeetingResponse
from UTILS.audio_processor import process_input
from core.graph_pipeline import pipeline as concept_pipeline
from fastapi.responses import Response
from core.pdf_export import generate_notes_pdf


router = APIRouter()


def process_meeting_background(meeting_id: str, source: str, language: str, is_podcast: bool = False):
    db = SessionLocal()
    try:
        meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
        if not meeting:
            return

        chunks = process_input(source)

        if is_podcast:
            from core.transcriber import transcribe_with_speakers
            transcript = transcribe_with_speakers(chunks[0])
        else:
            transcript = transcribe_all(chunks, language)

        title = generate_title(transcript)
        summary = summarize(transcript)

        existing_topics = db.query(Topic).filter(Topic.user_id == meeting.user_id).all()
        existing_topics_list = [{"id": t.id, "name": t.name} for t in existing_topics]
        topic_suggestion = suggest_topic(summary, existing_topics_list)
        print("DEBUG topic suggestion:", topic_suggestion)

        concepts_result = extract_concepts(transcript)
        print("DEBUG concepts raw result:", concepts_result)

        meeting.title = title
        meeting.transcript = transcript
        meeting.summary = summary
        meeting.status = "done"

        for c in concepts_result.concepts:
            db.add(Concept(meeting_id=meeting.id, name=c.name, explanation=c.explanation, is_claim=c.is_claim))

        db.commit()

        build_vector_store(transcript, meeting.id, topic_id=None, title=title)

    except Exception as e:
        print(f"ERROR processing meeting {meeting_id}: {e}")
        meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
        if meeting:
            meeting.status = "failed"
            db.commit()
    finally:
        db.close()


@router.post("/meetings", response_model=MeetingResponse)
def create_meeting(request: MeetingCreateRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    meeting = Meeting(
        source=request.source,
        language=request.language,
        status="processing",
        user_id=current_user.id,
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)

    background_tasks.add_task(process_meeting_background, meeting.id, request.source, request.language, request.is_podcast)

    return meeting


@router.get("/meetings/{meeting_id}", response_model=MeetingResponse)
def get_meeting(meeting_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    if meeting.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your meeting")
    return meeting


@router.post("/meetings/{meeting_id}/confirm-topic")
def confirm_topic(meeting_id: str, request: TopicConfirmRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id, Meeting.user_id == current_user.id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    if request.topic_id:
        topic = db.query(Topic).filter(Topic.id == request.topic_id, Topic.user_id == current_user.id).first()
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found")
        meeting.topic_id = topic.id
    elif request.new_topic_name:
        new_topic = Topic(user_id=current_user.id, name=request.new_topic_name)
        db.add(new_topic)
        db.commit()
        db.refresh(new_topic)
        meeting.topic_id = new_topic.id
    else:
        raise HTTPException(status_code=400, detail="Must provide either topic_id or new_topic_name")

    db.commit()
    db.refresh(meeting)

    if meeting.transcript:
        build_vector_store(meeting.transcript, meeting.id, topic_id=meeting.topic_id, title=meeting.title)

    past_meetings = db.query(Meeting).filter(
        Meeting.topic_id == meeting.topic_id,
        Meeting.id != meeting.id,
        Meeting.status == "done"
    ).all()

    known_concepts_in_topic = []
    past_claims_in_topic = []
    for pm in past_meetings:
        past_concepts = db.query(Concept).filter(Concept.meeting_id == pm.id).all()
        for pc in past_concepts:
            known_concepts_in_topic.append(pc.name)
            if pc.is_claim:
                past_claims_in_topic.append(f"{pc.name}: {pc.explanation}")

    initial_state = {
        "transcript": meeting.transcript,
        "meeting_id": meeting.id,
        "topic_id": meeting.topic_id,
        "known_concepts_in_topic": known_concepts_in_topic,
        "past_claims_in_topic": past_claims_in_topic,
        "concepts": [],
        "quality": "",
        "retry_count": 0,
        "gaps": [],
        "contradictions": [],
    }

    pipeline_result = concept_pipeline.invoke(initial_state)
    print("DEBUG pipeline result — gaps:", pipeline_result["gaps"])
    print("DEBUG pipeline result — contradictions:", pipeline_result["contradictions"])

    db.query(Concept).filter(Concept.meeting_id == meeting.id).delete()
    for c in pipeline_result["concepts"]:
        db.add(Concept(meeting_id=meeting.id, name=c["name"], explanation=c["explanation"], is_claim=c["is_claim"]))

       # Save gaps as persistent KnowledgeFlag rows
    for gap in pipeline_result["gaps"]:
        db.add(KnowledgeFlag(
            topic_id=meeting.topic_id,
            meeting_id=meeting.id,
            flag_type="gap",
            concept_name=gap.get("referenced_concept"),
            description=gap.get("why_its_a_gap", "No explanation provided."),
        ))

    # Save contradictions as persistent KnowledgeFlag rows
    for contradiction in pipeline_result["contradictions"]:
        db.add(KnowledgeFlag(
            topic_id=meeting.topic_id,
            meeting_id=meeting.id,
            flag_type="contradiction",
            concept_name=contradiction.get("new_claim"),
            description=(
                f"New: {contradiction.get('new_claim', '')} — "
                f"Conflicts with: {contradiction.get('conflicting_claim', '')}. "
                f"{contradiction.get('explanation', '')}"
            ),
        ))

    db.commit()

    return {
        "meeting_id": meeting.id,
        "topic_id": meeting.topic_id,
        "gaps": pipeline_result["gaps"],
        "contradictions": pipeline_result["contradictions"],
    }


@router.get("/meetings/{meeting_id}/export-pdf")
def export_meeting_pdf(meeting_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id, Meeting.user_id == current_user.id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    concepts = db.query(Concept).filter(Concept.meeting_id == meeting_id).all()
    concepts_data = [{"name": c.name, "explanation": c.explanation} for c in concepts]

    pdf_bytes = generate_notes_pdf(meeting.title, meeting.summary, concepts_data)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{meeting.title or "notes"}.pdf"'}
    )
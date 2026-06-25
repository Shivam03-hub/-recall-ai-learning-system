"""
Topic-level endpoints — cross-content Q&A scoped to a single topic,
plus persistent chat history, rename, and delete.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from core.cross_topic_rag import generate_custom_pdf_content
from core.pdf_export import generate_notes_pdf
from schemas.topic import PdfGenerateRequest
from fastapi.responses import Response
from db.database import get_db
from db.models import Topic, User, ChatMessage, GeneratedPdf, Meeting, Quiz, QuizQuestion, KnowledgeFlag
from auth.dependencies import get_current_user
from schemas.topic import TopicAskRequest, TopicAskResponse
from core.cross_topic_rag import ask_across_topic

router = APIRouter(prefix="/topics", tags=["topics"])


class TopicRenameRequest(BaseModel):
    name: str


@router.post("/{topic_id}/ask", response_model=TopicAskResponse)
def ask_topic(topic_id: str, request: TopicAskRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    topic = db.query(Topic).filter(Topic.id == topic_id, Topic.user_id == current_user.id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    result = ask_across_topic(db, topic_id, request.question)

    chat_entry = ChatMessage(
        user_id=current_user.id,
        topic_id=topic_id,
        question=request.question,
        answer=result["answer"],
        sources=", ".join(result["sources"]),
    )
    db.add(chat_entry)
    db.commit()

    return result


@router.get("/{topic_id}/chat-history")
def get_chat_history(topic_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    topic = db.query(Topic).filter(Topic.id == topic_id, Topic.user_id == current_user.id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    messages = db.query(ChatMessage).filter(
        ChatMessage.topic_id == topic_id,
        ChatMessage.user_id == current_user.id
    ).order_by(ChatMessage.created_at.asc()).all()

    return [
        {
            "id": m.id,
            "question": m.question,
            "answer": m.answer,
            "sources": m.sources.split(", ") if m.sources else [],
            "created_at": m.created_at,
        }
        for m in messages
    ]


@router.get("/")
def list_topics(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """List all topics for the current user — needed for a library sidebar."""
    topics = db.query(Topic).filter(Topic.user_id == current_user.id).all()
    return [{"id": t.id, "name": t.name} for t in topics]


@router.patch("/{topic_id}/rename")
def rename_topic(topic_id: str, request: TopicRenameRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    topic = db.query(Topic).filter(Topic.id == topic_id, Topic.user_id == current_user.id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    if not request.name.strip():
        raise HTTPException(status_code=400, detail="Topic name cannot be empty")

    topic.name = request.name.strip()
    db.commit()
    return {"id": topic.id, "name": topic.name}


@router.delete("/{topic_id}")
def delete_topic(topic_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    topic = db.query(Topic).filter(Topic.id == topic_id, Topic.user_id == current_user.id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    # Clean up everything linked to this topic before deleting it
    meeting_ids = [m.id for m in db.query(Meeting).filter(Meeting.topic_id == topic_id).all()]

    quiz_ids = [q.id for q in db.query(Quiz).filter(Quiz.topic_id == topic_id).all()]
    if quiz_ids:
        db.query(QuizQuestion).filter(QuizQuestion.quiz_id.in_(quiz_ids)).delete(synchronize_session=False)
    db.query(Quiz).filter(Quiz.topic_id == topic_id).delete(synchronize_session=False)

    db.query(ChatMessage).filter(ChatMessage.topic_id == topic_id).delete(synchronize_session=False)
    db.query(GeneratedPdf).filter(GeneratedPdf.topic_id == topic_id).delete(synchronize_session=False)

    if meeting_ids:
        db.query(Meeting).filter(Meeting.id.in_(meeting_ids)).delete(synchronize_session=False)

    db.delete(topic)
    db.commit()
    return {"deleted": True}


@router.post("/{topic_id}/generate-pdf")
def generate_pdf(topic_id: str, request: PdfGenerateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    topic = db.query(Topic).filter(Topic.id == topic_id, Topic.user_id == current_user.id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    content = generate_custom_pdf_content(db, topic_id, request.instruction)

    record = GeneratedPdf(
        user_id=current_user.id,
        topic_id=topic_id,
        instruction=request.instruction,
        content=content,
    )
    db.add(record)
    db.commit()

    pdf_bytes = generate_notes_pdf(topic.name, content, [])

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{topic.name}.pdf"'}
    )


@router.get("/{topic_id}/pdf-history")
def get_pdf_history(topic_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    topic = db.query(Topic).filter(Topic.id == topic_id, Topic.user_id == current_user.id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    pdfs = db.query(GeneratedPdf).filter(
        GeneratedPdf.topic_id == topic_id, GeneratedPdf.user_id == current_user.id
    ).order_by(GeneratedPdf.created_at.desc()).all()

    return [
        {"id": p.id, "instruction": p.instruction, "created_at": p.created_at}
        for p in pdfs
    ]


@router.get("/{topic_id}/pdf-history/{pdf_id}/download")
def download_past_pdf(topic_id: str, pdf_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    record = db.query(GeneratedPdf).filter(GeneratedPdf.id == pdf_id, GeneratedPdf.user_id == current_user.id).first()
    if not record:
        raise HTTPException(status_code=404, detail="PDF record not found")

    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    pdf_bytes = generate_notes_pdf(topic.name if topic else "Notes", record.content, [])

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="recall-notes.pdf"'}
    )

@router.get("/{topic_id}/knowledge-flags")
def get_knowledge_flags(topic_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    topic = db.query(Topic).filter(Topic.id == topic_id, Topic.user_id == current_user.id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    flags = db.query(KnowledgeFlag).filter(KnowledgeFlag.topic_id == topic_id).order_by(KnowledgeFlag.created_at.desc()).all()

    return {
        "gaps": [{"id": f.id, "concept_name": f.concept_name, "description": f.description} for f in flags if f.flag_type == "gap"],
        "contradictions": [{"id": f.id, "concept_name": f.concept_name, "description": f.description} for f in flags if f.flag_type == "contradiction"],
    }


@router.get("/{topic_id}/meetings")
def list_topic_meetings(topic_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    topic = db.query(Topic).filter(Topic.id == topic_id, Topic.user_id == current_user.id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    meetings = db.query(Meeting).filter(Meeting.topic_id == topic_id).order_by(Meeting.created_at.desc()).all()

    return [
        {
            "id": m.id,
            "title": m.title,
            "source": m.source,
            "status": m.status,
            "created_at": m.created_at,
        }
        for m in meetings
    ]
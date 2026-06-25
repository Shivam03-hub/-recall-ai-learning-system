"""
Quiz generation, submission, and scoring endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from schemas.topic import FlashcardResponse
from typing import List
from db.database import get_db
from db.models import User, Topic, Quiz, QuizQuestion
from auth.dependencies import get_current_user
from schemas.topic import QuizGenerateRequest, QuizResponse, QuizSubmitRequest, QuizResultResponse
from core.quiz_engine import generate_quiz_questions, score_quiz

router = APIRouter(prefix="/topics", tags=["quizzes"])


@router.post("/{topic_id}/quiz", response_model=QuizResponse)
def create_quiz(topic_id: str, request: QuizGenerateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    topic = db.query(Topic).filter(Topic.id == topic_id, Topic.user_id == current_user.id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    generated = generate_quiz_questions(db, topic_id, request.num_questions, request.difficulty, request.custom_instruction)
    if not generated.questions:
        raise HTTPException(status_code=400, detail="No content available to generate a quiz from.")

    quiz = Quiz(user_id=current_user.id, topic_id=topic_id)
    db.add(quiz)
    db.commit()
    db.refresh(quiz)

    for gq in generated.questions:
        db.add(QuizQuestion(
            quiz_id=quiz.id,
            question=gq.question,
            correct_answer=gq.correct_answer,
            related_concept=gq.related_concept,
        ))
    db.commit()
    db.refresh(quiz)

    return quiz


@router.post("/{topic_id}/quiz/{quiz_id}/submit", response_model=QuizResultResponse)
def submit_quiz(topic_id: str, quiz_id: str, request: QuizSubmitRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id, Quiz.user_id == current_user.id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    questions = db.query(QuizQuestion).filter(QuizQuestion.quiz_id == quiz_id).all()
    submitted_map = {a.question_id: a.answer for a in request.answers}

    result = score_quiz(submitted_map, questions)

    for q in questions:
        if q.id in submitted_map:
            q.user_answer = submitted_map[q.id]
            q.is_correct = any(r["question"] == q.question and r["is_correct"] for r in result["results"])
    db.commit()

    return result

@router.get("/{topic_id}/flashcards/{quiz_id}", response_model=List[FlashcardResponse])
def get_flashcards(topic_id: str, quiz_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id, Quiz.user_id == current_user.id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    questions = db.query(QuizQuestion).filter(QuizQuestion.quiz_id == quiz_id, QuizQuestion.is_correct.is_(False)).all()
    weak_concepts = [q.related_concept for q in questions if q.related_concept]

    from core.quiz_engine import generate_flashcards_from_weak_areas
    return generate_flashcards_from_weak_areas(weak_concepts, db, topic_id)


@router.get("/{topic_id}/quizzes")
def list_quizzes(topic_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    topic = db.query(Topic).filter(Topic.id == topic_id, Topic.user_id == current_user.id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    quizzes = db.query(Quiz).filter(Quiz.topic_id == topic_id, Quiz.user_id == current_user.id).order_by(Quiz.created_at.desc()).all()

    result = []
    for q in quizzes:
        questions = db.query(QuizQuestion).filter(QuizQuestion.quiz_id == q.id).all()
        answered = sum(1 for ques in questions if ques.user_answer is not None)
        correct = sum(1 for ques in questions if ques.is_correct)
        result.append({
            "id": q.id,
            "created_at": q.created_at,
            "total_questions": len(questions),
            "answered": answered,
            "score": correct if answered > 0 else None,
        })
    return result

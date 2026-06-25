"""
Generates gap-targeted quiz questions and scores submitted answers.
"""

import os
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field
from typing import List
from sqlalchemy.orm import Session

from db.models import Meeting, Concept


def get_llm():
    return ChatGroq(model="llama-3.3-70b-versatile", groq_api_key=os.getenv("GROQ_API_KEY"), temperature=0.3)


class GeneratedQuestion(BaseModel):
    question: str = Field(description="A clear quiz question")
    correct_answer: str = Field(description="The correct answer, concise")
    related_concept: str = Field(description="Which concept this question is testing")


class QuizGenerationResult(BaseModel):
    questions: List[GeneratedQuestion]

def generate_quiz_questions(db: Session, topic_id: str, num_questions: int = 10, difficulty: str = "medium", custom_instruction: str = "") -> QuizGenerationResult:
    meetings = db.query(Meeting).filter(Meeting.topic_id == topic_id, Meeting.status == "done").all()

    all_concepts = []
    for m in meetings:
        concepts = db.query(Concept).filter(Concept.meeting_id == m.id).all()
        all_concepts.extend([f"{c.name}: {c.explanation}" for c in concepts])

    if not all_concepts:
        return QuizGenerationResult(questions=[])

    concepts_text = "\n".join(all_concepts)

    llm = get_llm()
    structured_llm = llm.with_structured_output(QuizGenerationResult)

    difficulty_guidance = {
        "easy": "Ask straightforward recall questions that test basic understanding of each concept.",
        "medium": "Ask questions that require understanding the concept well enough to explain or apply it, not just recall a definition.",
        "hard": "Ask challenging questions that require applying the concept to a new scenario, comparing it to another concept, or explaining edge cases.",
    }

    custom_part = f"\n\nAdditional instruction from the user: {custom_instruction}" if custom_instruction.strip() else ""

    prompt = ChatPromptTemplate.from_messages([
        ("system",
         f"Generate exactly {num_questions} quiz questions testing understanding of the "
         f"concepts below, at {difficulty} difficulty. {difficulty_guidance.get(difficulty, difficulty_guidance['medium'])} "
         "Each question should have a clear, concise correct answer. "
         f"Mark which concept each question relates to.{custom_part}"),
        ("human", "Concepts:\n{concepts}"),
    ])

    chain = prompt | structured_llm
    return chain.invoke({"concepts": concepts_text})


def score_quiz(submitted_answers: dict, questions: list) -> dict:
    """
    submitted_answers: {question_id: user_answer}
    questions: list of QuizQuestion DB objects
    """
    llm = get_llm()

    results = []
    weak_areas = []
    correct_count = 0

    for q in questions:
        user_answer = submitted_answers.get(q.id, "")

        # Empty/blank answers are automatically wrong — no need to ask the LLM
        if not user_answer.strip():
            is_correct = False
            if q.related_concept:
                weak_areas.append(q.related_concept)
            results.append({
                "question": q.question,
                "your_answer": user_answer,
                "correct_answer": q.correct_answer,
                "is_correct": False,
                "related_concept": q.related_concept,
            })
            continue

        

        # Use LLM to judge correctness (handles paraphrased/close answers, not just exact match)
        judge_prompt = ChatPromptTemplate.from_messages([
            ("system", "Judge if the user's answer is substantially correct compared to the "
                       "correct answer, even if worded differently. Respond with only 'CORRECT' or 'INCORRECT'."),
            ("human", "Question: {question}\nCorrect answer: {correct}\nUser's answer: {user_answer}"),
        ])
        judge_chain = judge_prompt | llm
        verdict = judge_chain.invoke({
            "question": q.question,
            "correct": q.correct_answer,
            "user_answer": user_answer
        }).content.strip().upper()

        is_correct = "CORRECT" in verdict and "INCORRECT" not in verdict

        if is_correct:
            correct_count += 1
        else:
            if q.related_concept:
                weak_areas.append(q.related_concept)

        results.append({
            "question": q.question,
            "your_answer": user_answer,
            "correct_answer": q.correct_answer,
            "is_correct": is_correct,
            "related_concept": q.related_concept,
        })

    return {
        "score": correct_count,
        "total": len(questions),
        "weak_areas": list(set(weak_areas)),
        "results": results,
    }

def generate_flashcards_from_weak_areas(weak_areas: list[str], db: Session, topic_id: str) -> list[dict]:
    if not weak_areas:
        return []

    concepts = db.query(Concept).join(Meeting).filter(
        Meeting.topic_id == topic_id,
        Concept.name.in_(weak_areas)
    ).all()

    return [{"front": c.name, "back": c.explanation} for c in concepts]
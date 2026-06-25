"""
Database table definitions.
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import Boolean
from db.database import Base


def generate_uuid():
    return str(uuid.uuid4())


class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    topic_id = Column(UUID(as_uuid=False), ForeignKey("topics.id"), nullable=True)
    title = Column(String, nullable=True)
    source = Column(String, nullable=False)
    language = Column(String, default="english")
    transcript = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)
    status = Column(String, default="pending")
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    concepts = relationship("Concept", back_populates="meeting", cascade="all, delete-orphan")
    owner = relationship("User", back_populates="meetings")
    topic = relationship("Topic", back_populates="meetings")



class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    meetings = relationship("Meeting", back_populates="owner")


class Topic(Base):
    __tablename__ = "topics"

    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    meetings = relationship("Meeting", back_populates="topic")


class Concept(Base):
    __tablename__ = "concepts"

    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    meeting_id = Column(UUID(as_uuid=False), ForeignKey("meetings.id"), nullable=False)
    name = Column(String, nullable=False)
    explanation = Column(Text, nullable=False)
    is_claim = Column(Boolean, default=False)

    meeting = relationship("Meeting", back_populates="concepts")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    topic_id = Column(UUID(as_uuid=False), ForeignKey("topics.id"), nullable=False)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    sources = Column(Text, nullable=True)  # stored as comma-separated titles for simplicity
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class Quiz(Base):
    __tablename__ = "quizzes"

    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    topic_id = Column(UUID(as_uuid=False), ForeignKey("topics.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    questions = relationship("QuizQuestion", back_populates="quiz", cascade="all, delete-orphan")


class QuizQuestion(Base):
    __tablename__ = "quiz_questions"

    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    quiz_id = Column(UUID(as_uuid=False), ForeignKey("quizzes.id"), nullable=False)
    question = Column(Text, nullable=False)
    correct_answer = Column(Text, nullable=False)
    user_answer = Column(Text, nullable=True)
    is_correct = Column(Boolean, nullable=True)
    related_concept = Column(String, nullable=True)  # which gap/concept this targets

    quiz = relationship("Quiz", back_populates="questions")


class GeneratedPdf(Base):
    __tablename__ = "generated_pdfs"

    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    topic_id = Column(UUID(as_uuid=False), ForeignKey("topics.id"), nullable=False)
    instruction = Column(Text, nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

class KnowledgeFlag(Base):
    __tablename__ = "knowledge_flags"

    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    topic_id = Column(UUID(as_uuid=False), ForeignKey("topics.id"), nullable=False)
    meeting_id = Column(UUID(as_uuid=False), ForeignKey("meetings.id"), nullable=True)
    flag_type = Column(String, nullable=False)  # "gap" or "contradiction"
    concept_name = Column(String, nullable=True)
    description = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
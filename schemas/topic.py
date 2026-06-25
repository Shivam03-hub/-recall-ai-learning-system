from pydantic import BaseModel
from typing import Optional
from typing import List

class TopicResponse(BaseModel):
    id: str
    name: str

    class Config:
        from_attributes = True


class TopicSuggestionResponse(BaseModel):
    matched_existing_topic_id: Optional[str] = None
    suggested_new_topic_name: Optional[str] = None
    confidence: str
    reasoning: str


class TopicConfirmRequest(BaseModel):
    meeting_id: str
    topic_id: Optional[str] = None       # if confirming an existing match
    new_topic_name: Optional[str] = None  # if creating a new topic instead

class TopicAskRequest(BaseModel):
    question: str


class TopicAskResponse(BaseModel):
    answer: str
    sources: list[str]

class PdfGenerateRequest(BaseModel):
    instruction: str




class QuizQuestionResponse(BaseModel):
    id: str
    question: str
    related_concept: Optional[str] = None

    class Config:
        from_attributes = True


class QuizResponse(BaseModel):
    id: str
    questions: List[QuizQuestionResponse]

    class Config:
        from_attributes = True


class QuizAnswerItem(BaseModel):
    question_id: str
    answer: str


class QuizSubmitRequest(BaseModel):
    answers: List[QuizAnswerItem]


class QuizResultItem(BaseModel):
    question: str
    your_answer: str
    correct_answer: str
    is_correct: bool
    related_concept: Optional[str] = None


class QuizResultResponse(BaseModel):
    score: int
    total: int
    weak_areas: List[str]
    results: List[QuizResultItem]

class FlashcardResponse(BaseModel):
    front: str
    back: str

class QuizGenerateRequest(BaseModel):
    num_questions: int = 10
    difficulty: str = "medium"
    custom_instruction: str = ""
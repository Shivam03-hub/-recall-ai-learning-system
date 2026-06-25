"""
Pydantic schemas — these define the SHAPE of data going in and out of the API.
"""

from pydantic import BaseModel
from typing import Optional, List


class MeetingCreateRequest(BaseModel):
    source: str
    language: str = "english"
    is_podcast: bool = False

class ConceptResponse(BaseModel):
    name: str
    explanation: str
    is_claim: bool

    class Config:
        from_attributes = True


class MeetingResponse(BaseModel):
    id: str
    title: Optional[str]
    status: str
    summary: Optional[str]
    transcript: Optional[str] = None
    source: Optional[str] = None
    topic_id: Optional[str]
    concepts: List[ConceptResponse] = []

    class Config:
        from_attributes = True
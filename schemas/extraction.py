"""
Schemas that FORCE the LLM to respond in an exact shape.
"""

from pydantic import BaseModel, Field
from typing import List


class ConceptSchema(BaseModel):
    name: str = Field(description="Short name of the concept/topic discussed, e.g. 'Two-Minute Rule'")
    explanation: str = Field(description="A clear 1-3 sentence explanation of this concept as presented in the content")
    is_claim: bool = Field(description="True if this is a factual claim/assertion that could be verified or could conflict with another source, False if it's general framing/advice")


class ConceptsList(BaseModel):
    concepts: List[ConceptSchema] = Field(description="All distinct concepts, definitions, or claims covered in this content")
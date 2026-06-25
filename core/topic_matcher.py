"""
Topic matching — given new content, decide if it belongs to an existing
topic or needs a new one. Returns a suggestion; does NOT auto-assign.
"""

from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field
from typing import Optional
import os


class TopicSuggestion(BaseModel):
    matched_existing_topic_id: Optional[str] = Field(
        default=None, description="ID of the existing topic this content belongs to, or null if none match well"
    )
    suggested_new_topic_name: Optional[str] = Field(
        default=None, description="A clean topic name if no existing topic fits, else null"
    )
    confidence: str = Field(description="high, medium, or low — how sure you are about this match")
    reasoning: str = Field(description="One sentence explaining the decision")


def get_llm():
    return ChatGroq(model="llama-3.3-70b-versatile", groq_api_key=os.getenv("GROQ_API_KEY"), temperature=0.1)


def suggest_topic(transcript_summary: str, existing_topics: list[dict]) -> TopicSuggestion:
    """
    existing_topics: list of {"id": "...", "name": "..."} for this user's existing topics.
    """
    llm = get_llm()
    structured_llm = llm.with_structured_output(TopicSuggestion)

    topics_list_text = "\n".join([f"- id: {t['id']}, name: {t['name']}" for t in existing_topics]) or "No existing topics yet."

    prompt = ChatPromptTemplate.from_messages([
        ("system",
         "You are a knowledge organization assistant. Given a summary of new content "
         "and a list of the user's EXISTING topics, decide if this content belongs to "
         "one of the existing topics, or if it needs a brand new topic.\n\n"
         "Existing topics:\n{topics}\n\n"
         "Only match an existing topic if it's genuinely the same subject area. "
         "If unsure, prefer suggesting a new topic over a weak match."),
        ("human", "{content}"),
    ])

    chain = prompt | structured_llm
    return chain.invoke({"topics": topics_list_text, "content": transcript_summary})
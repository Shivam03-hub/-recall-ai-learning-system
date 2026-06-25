"""
Concept extraction — pulls out key concepts, definitions, and claims
from learning content (videos, podcasts, lectures).
"""

import os

from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq

from schemas.extraction import ConceptsList


def get_llm():
    return ChatGroq(
        model="llama-3.3-70b-versatile",
        groq_api_key=os.getenv("GROQ_API_KEY"),
        temperature=0.2,
    )


def extract_concepts(transcript: str) -> ConceptsList:
    llm = get_llm()
    structured_llm = llm.with_structured_output(ConceptsList)

    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                "You are an expert at breaking down educational content into its core concepts. "
                "From the transcript, extract every distinct concept, definition, or factual claim "
                "that was taught or asserted.\n\n"
                "CRITICAL RULE: Only include what is ACTUALLY EXPLAINED in this specific transcript. "
                "If the speaker MENTIONS or REFERENCES a concept by name but does NOT explain what it "
                "means within this transcript, do NOT fill in the explanation from your own knowledge — "
                "instead, set explanation to exactly: 'Referenced but not explained in this content.' "
                "This is important even if you personally know what the term means — your job is to "
                "reflect what THIS content actually taught, not what you know.\n\n"
                "Skip filler like calls-to-action, video promotions, or greetings — focus only on "
                "actual educational content.",
            ),
            ("human", "{text}"),
        ]
    )

    chain = prompt | structured_llm
    return chain.invoke({"text": transcript})

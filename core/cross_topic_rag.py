"""
Cross-content RAG — searches across ALL meetings under a given topic,
not just one. Merges results and attributes each answer to its source.
"""

import os
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from sqlalchemy.orm import Session

from db.models import Meeting
from core.vector_store import load_vector_store, get_retriever


def get_llm():
    return ChatGroq(model="llama-3.3-70b-versatile", groq_api_key=os.getenv("GROQ_API_KEY"), temperature=0.3)


def retrieve_across_topic(db: Session, topic_id: str, question: str, k_per_meeting: int = 3) -> list[dict]:
    """
    Gathers relevant chunks from EVERY meeting under this topic.
    Returns a list of {content, meeting_title, meeting_id} dicts.
    """
    meetings = db.query(Meeting).filter(Meeting.topic_id == topic_id, Meeting.status == "done").all()

    all_results = []
    for meeting in meetings:
        try:
            vector_store = load_vector_store(meeting.id)
            retriever = get_retriever(vector_store, k=k_per_meeting)
            docs = retriever.invoke(question)
            for doc in docs:
                all_results.append({
                    "content": doc.page_content,
                    "meeting_title": meeting.title or "Untitled",
                    "meeting_id": meeting.id,
                })
        except Exception as e:
            print(f"Skipping meeting {meeting.id} (no vector store found): {e}")
            continue

    return all_results


def ask_across_topic(db: Session, topic_id: str, question: str) -> dict:
    retrieved = retrieve_across_topic(db, topic_id, question)

    if not retrieved:
        return {
            "answer": "I couldn't find any processed content under this topic to answer from.",
            "sources": [],
        }

    context_blocks = "\n\n".join(
        [f"[Source: {r['meeting_title']}]\n{r['content']}" for r in retrieved]
    )

    llm = get_llm()
    prompt = ChatPromptTemplate.from_messages([
        ("system",
         "You are a learning assistant. Answer the user's question using ONLY the "
         "context below, which comes from multiple videos/podcasts on this topic. "
         "When you use information from a source, mention which video it came from "
         "(e.g. 'According to [video title]...'). If the answer isn't in the context, "
         "say so clearly.\n\nContext:\n{context}"),
        ("human", "{question}"),
    ])

    chain = prompt | llm
    response = chain.invoke({"context": context_blocks, "question": question})

    sources = list({r["meeting_title"] for r in retrieved})

    return {
        "answer": response.content,
        "sources": sources,
    }

def generate_custom_pdf_content(db: Session, topic_id: str, instruction: str) -> str:
    """
    Generates document content based on the user's exact request, grounded
    in the topic's content (used by the PDF-GEN button).
    """
    retrieved = retrieve_across_topic(db, topic_id, instruction, k_per_meeting=5)

    if not retrieved:
        return "No content found for this topic."

    context_blocks = "\n\n".join(
        [f"[Source: {r['meeting_title']}]\n{r['content']}" for r in retrieved]
    )

    llm = get_llm()
    prompt = ChatPromptTemplate.from_messages([
        ("system",
         "You generate document content based on the user's exact request, using ONLY the "
         "context provided below from their learning library. Follow their format request "
         "precisely (length, style, question count, etc). If they ask for exam questions, "
         "generate genuine, well-formed questions with answers grounded in the context. "
         "If they ask for a summary of a specific length, match that length as closely as "
         "possible.\n\nContext:\n{context}"),
        ("human", "{instruction}"),
    ])

    chain = prompt | llm
    response = chain.invoke({"context": context_blocks, "instruction": instruction})
    return response.content
"""
Individual nodes for the LangGraph pipeline. Each function takes the
current state, does ONE job, and returns the updated state.
"""

import os
from typing import List

from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq
from pydantic import BaseModel, Field

from core.extractor import extract_concepts
from core.graph_state import PipelineState


def get_llm():
    return ChatGroq(
        model="llama-3.3-70b-versatile",
        groq_api_key=os.getenv("GROQ_API_KEY"),
        temperature=0.2,
    )


# ---------------------------------------------------------------------------
# NODE 1 — Extractor
# ---------------------------------------------------------------------------
def extractor_node(state: PipelineState) -> PipelineState:
    print(f"[Extractor Node] Running, attempt {state['retry_count'] + 1}")
    result = extract_concepts(state["transcript"])
    state["concepts"] = [c.model_dump() for c in result.concepts]
    state["retry_count"] = state["retry_count"] + 1
    return state


# ---------------------------------------------------------------------------
# NODE 2 — Quality Check
# ---------------------------------------------------------------------------
class QualityCheckResult(BaseModel):
    quality: str = Field(
        description="'good' if extraction seems complete and meaningful, 'needs_retry' if too sparse or low-quality"
    )
    reason: str = Field(description="One sentence explaining the quality judgment")


def quality_check_node(state: PipelineState) -> PipelineState:
    print("[Quality Check Node] Running")

    if len(state["concepts"]) == 0:
        print("[Quality Check Node] Zero concepts found — needs retry")
        state["quality"] = "needs_retry"
        return state

    llm = get_llm()
    structured_llm = llm.with_structured_output(QualityCheckResult)
    concepts_text = "\n".join(
        [f"- {c['name']}: {c['explanation']}" for c in state["concepts"]]
    )

    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                "You judge whether a list of extracted concepts from educational content "
                "is GOOD or NEEDS_RETRY.\n\n"
                "Mark as GOOD if: concepts are clearly named, and each either has a real "
                "explanation OR is correctly marked as 'Referenced but not explained in this "
                "content' (this marker is CORRECT behavior, not a flaw — do not penalize it).\n\n"
                "Mark as NEEDS_RETRY only if: the extraction is empty, garbled, completely "
                "off-topic, or clearly missed obvious content covered in the transcript.",
            ),
            ("human", "Concepts extracted:\n{concepts}"),
        ]
    )
    chain = prompt | structured_llm
    result = chain.invoke({"concepts": concepts_text})

    print(f"[Quality Check Node] Verdict: {result.quality} — {result.reason}")
    state["quality"] = result.quality
    return state


def route_after_quality_check(state: PipelineState) -> str:
    if state["quality"] == "needs_retry" and state["retry_count"] < 3:
        return "extractor"
    return "gap_detector"


# ---------------------------------------------------------------------------
# NODE 3 — Gap Detector
# ---------------------------------------------------------------------------


class GapSchema(BaseModel):
    referenced_concept: str = Field(
        description="The concept this content assumes you already know"
    )
    why_its_a_gap: str = Field(
        description="Brief explanation of why this seems assumed/unexplained"
    )


class GapDetectionResult(BaseModel):
    gaps: List[GapSchema] = Field(
        description="Concepts assumed but not explained, that aren't in the known concepts list"
    )


def gap_detector_node(state: PipelineState) -> PipelineState:
    print("[Gap Detector Node] Running")

    # First, a direct check — anything explicitly marked as unexplained is automatically a gap
    explicit_gaps = [
        {
            "referenced_concept": c["name"],
            "why_its_a_gap": "Mentioned by name but not explained in this content.",
        }
        for c in state["concepts"]
        if "not explained in this content" in c["explanation"].lower()
    ]

    known_concepts = state.get("known_concepts_in_topic", [])

    llm_gaps = []
    
    if known_concepts:
        llm = get_llm()
        structured_llm = llm.with_structured_output(GapDetectionResult)

        known_text = "\n".join([f"- {c}" for c in known_concepts])
        new_concepts_text = "\n".join(
            [f"- {c['name']}: {c['explanation']}" for c in state["concepts"]]
        )

        prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    "You're checking for knowledge gaps. The user has previously learned these concepts:\n"
                    "{known}\n\nThe NEW content covers these concepts:\n{new}\n\n"
                    "Does the new content's explanations seem to ASSUME any concept that is NOT in the "
                    "known list and NOT explained within the new content itself? Only flag genuine gaps. "
                    "If everything is self-contained or already known, return an empty list.",
                ),
                ("human", "Check for gaps."),
            ]
        )
        chain = prompt | structured_llm
        result = chain.invoke({"known": known_text, "new": new_concepts_text})
        llm_gaps = [g.model_dump() for g in result.gaps]

    all_gaps = explicit_gaps + llm_gaps
    print(
        f"[Gap Detector Node] Found {len(all_gaps)} gap(s) ({len(explicit_gaps)} explicit, {len(llm_gaps)} from LLM reasoning)"
    )
    state["gaps"] = all_gaps
    return state


# ---------------------------------------------------------------------------
# NODE 4 — Contradiction Checker
# ---------------------------------------------------------------------------
class ContradictionSchema(BaseModel):
    new_claim: str = Field(description="The claim from the new content")
    conflicting_claim: str = Field(description="The earlier claim it conflicts with")
    explanation: str = Field(description="Why these genuinely conflict, not just differ in framing")


class ContradictionCheckResult(BaseModel):
    contradictions: List[ContradictionSchema] = Field(
        description="Genuine contradictions found. Empty list if none — do not force false positives."
    )


def contradiction_checker_node(state: PipelineState) -> PipelineState:
    print("[Contradiction Checker Node] Running")

    past_claims = state.get("past_claims_in_topic", [])
    new_claims = [c for c in state["concepts"] if c.get("is_claim")]

    if not past_claims or not new_claims:
        print("[Contradiction Checker Node] Nothing to compare — skipping")
        state["contradictions"] = []
        return state

    llm = get_llm()
    structured_llm = llm.with_structured_output(ContradictionCheckResult)

    past_text = "\n".join([f"- {c}" for c in past_claims])
    new_text = "\n".join([f"- {c['name']}: {c['explanation']}" for c in new_claims])

    prompt = ChatPromptTemplate.from_messages([
        ("system",
         "You check for genuine contradictions between claims from different sources.\n\n"
         "EARLIER claims (from past content in this topic):\n{past}\n\n"
         "NEW claims (from current content):\n{new}\n\n"
         "Flag ONLY genuine contradictions — where one claim directly conflicts with another "
         "(e.g. one says X helps, another says X doesn't help, or they recommend opposite "
         "approaches to the same situation). Do NOT flag claims that are simply about different "
         "topics, or that are complementary/compatible even if phrased differently. If unsure, "
         "do not flag it — false positives are worse than missing a subtle one."),
        ("human", "Check for contradictions."),
    ])

    chain = prompt | structured_llm
    result = chain.invoke({"past": past_text, "new": new_text})

    print(f"[Contradiction Checker Node] Found {len(result.contradictions)} contradiction(s)")
    state["contradictions"] = [c.model_dump() for c in result.contradictions]
    return state
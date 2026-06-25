"""
The shared state object that flows through every node in the graph.
Every node reads from this and writes back to it.
"""

from typing import TypedDict, List, Optional

   # filled by Contradiction-Checker node


class PipelineState(TypedDict):
    transcript: str
    meeting_id: str
    topic_id: Optional[str]

    known_concepts_in_topic: List[str]
    past_claims_in_topic: List[str]      # NEW

    concepts: List[dict]
    quality: str
    retry_count: int

    gaps: List[dict]
    contradictions: List[dict]

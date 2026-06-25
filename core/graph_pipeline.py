"""
Builds and compiles the LangGraph pipeline.
"""

from langgraph.graph import StateGraph, END
from core.graph_state import PipelineState
from core.graph_nodes import (
    extractor_node, quality_check_node, route_after_quality_check,
    gap_detector_node, contradiction_checker_node
)


def build_pipeline():
    graph = StateGraph(PipelineState)

    graph.add_node("extractor", extractor_node)
    graph.add_node("quality_check", quality_check_node)
    graph.add_node("gap_detector", gap_detector_node)
    graph.add_node("contradiction_checker", contradiction_checker_node)

    graph.set_entry_point("extractor")
    graph.add_edge("extractor", "quality_check")

    graph.add_conditional_edges(
        "quality_check",
        route_after_quality_check,
        {
            "extractor": "extractor",
            "gap_detector": "gap_detector",
        }
    )

    graph.add_edge("gap_detector", "contradiction_checker")
    graph.add_edge("contradiction_checker", END)

    return graph.compile()


pipeline = build_pipeline()
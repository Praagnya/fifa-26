from langgraph.graph import StateGraph, END

from backend.app.agents.state import AgentState
from backend.app.agents.nodes import orchestrator, liaison, scout


def _route_after_orchestrator(state: AgentState) -> str:
    """Route based on the classified intent."""
    intent = state.get("intent", "general")
    if intent == "flight_search":
        return "scout"
    # flight_refine skips scout (no API call) — goes straight to liaison
    return "liaison"


workflow = StateGraph(AgentState)

workflow.add_node("orchestrator", orchestrator)
workflow.add_node("scout", scout)
workflow.add_node("liaison", liaison)

workflow.set_entry_point("orchestrator")

# Conditional routing: flight_search → scout, everything else → liaison
workflow.add_conditional_edges(
    "orchestrator",
    _route_after_orchestrator,
    {"scout": "scout", "liaison": "liaison"},
)

# Scout always flows to liaison for final formatting
workflow.add_edge("scout", "liaison")
workflow.add_edge("liaison", END)

graph = workflow.compile()

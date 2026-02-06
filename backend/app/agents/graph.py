from langgraph.graph import StateGraph, END

from backend.app.agents.state import AgentState
from backend.app.agents.nodes import orchestrator, liaison, scout

workflow = StateGraph(AgentState)

workflow.add_node("orchestrator", orchestrator)
workflow.add_node("liaison", liaison)
workflow.add_node("scout", scout)

workflow.set_entry_point("orchestrator")
workflow.add_edge("orchestrator", "liaison")
workflow.add_edge("liaison", END)

graph = workflow.compile()

from backend.app.agents.state import AgentState


def orchestrator(state: AgentState) -> AgentState:
    """Routes the query to the right agent."""
    return state


def liaison(state: AgentState) -> AgentState:
    """Handles user-facing conversation."""
    return state


def scout(state: AgentState) -> AgentState:
    """Searches for information using tools."""
    return state

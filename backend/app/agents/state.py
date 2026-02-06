from typing import TypedDict


class AgentState(TypedDict):
    query: str
    messages: list
    current_agent: str
    result: str

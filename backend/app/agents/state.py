from typing import TypedDict, Annotated
from operator import add


class AgentState(TypedDict):
    query: str
    messages: Annotated[list, add]
    current_agent: str
    intent: str                     # orchestrator classification
    entities: dict                  # extracted: team names, city, date, etc.
    match_data: list[dict]          # matches fetched from DB
    departure_city: str             # user's origin city for flights
    flight_results: list[dict]      # Amadeus search results
    result: str                     # final response text
    session_id: str                 # conversation session id
    error: str                      # error messages if any

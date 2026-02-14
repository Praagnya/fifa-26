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
    departure_date: str             # optional explicit travel date (YYYY-MM-DD)
    preferred_airline: str          # optional IATA airline code preference
    flight_results: list[dict]      # Amadeus search results
    result: str                     # final response text
    session_id: str                 # conversation session id
    error: str                      # error messages if any
    user_timezone: str              # user's local timezone (e.g. "America/New_York")
    currency: str                   # user's preferred currency (e.g. "USD", "EUR")

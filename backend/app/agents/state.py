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
    hotel_results: dict | list      # Amadeus hotel search results (categorized dict or error list)
    check_in_date: str              # hotel check-in date (YYYY-MM-DD)
    check_out_date: str             # hotel check-out date (YYYY-MM-DD)
    show_hotel_search_form: bool    # UI trigger for hotel search form
    result: str                     # final response text
    session_id: str                 # conversation session id
    error: str                      # error messages if any
    user_timezone: str              # user's local timezone (e.g. "America/New_York")
    currency: str                   # user's preferred currency (e.g. "USD", "EUR")
    nonstop: bool                   # user wants nonstop/direct flights only
    max_results: int                # how many flights to return (default 10)

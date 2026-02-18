import sys
import os

# Add project root to path
sys.path.append(os.getcwd())

from unittest.mock import MagicMock
import sys
import os

# Mock backend.app.agents.nodes dependencies BEFORE importing it
import backend.app.agents.nodes
backend.app.agents.nodes._call_llm = MagicMock(return_value='{"intent": "hotel_search"}') 
backend.app.agents.nodes.search_hotels_for_match = MagicMock(return_value=[])

from backend.app.agents.nodes import concierge
from backend.app.agents.state import AgentState

# Mock state
state: AgentState = {
    "query": "nearest hotels",
    "messages": [],
    "current_agent": "concierge",
    "intent": "hotel_search",
    "entities": {"hotel_preference": "nearest", "city": "Dallas"}, # assume city extracted or match found
    "match_data": [{"city": "Dallas", "kickoff_utc": "2026-06-14T20:00:00"}],
    "departure_city": "",
    "departure_date": "",
    "preferred_airline": "",
    "flight_results": [],
    "hotel_results": [],
    "check_in_date": "",
    "check_out_date": "",
    "result": "",
    "session_id": "test",
    "error": "",
    "user_timezone": "UTC",
    "currency": "USD",
    "nonstop": False,
    "max_results": 10,
    "show_hotel_search_form": False
}

try:
    print("Running concierge...")
    result = concierge(state)
    print("Success!")
    print(result.keys())
except Exception as e:
    print(f"Caught exception: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()

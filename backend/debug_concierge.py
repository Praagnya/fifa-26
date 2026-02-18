
import os
import sys
import json
from dotenv import load_dotenv

# Add backend to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

load_dotenv()

from backend.app.agents.nodes import concierge
from backend.app.agents.state import AgentState

def test_concierge_interaction():
    print("--- Testing Concierge Interaction ---")
    
    # Mock State: User asks for hotels but extraction found NO preference
    # The node logic should pass empty hotel_results and hotel_preference=None to the prompt.
    mock_state = {
        "query": "Find hotels for France vs Senegal",
        "match_data": [{
            "city": "East Rutherford",
            "kickoff_utc": "2026-06-16T20:00:00",
            "stadium": "MetLife Stadium",
            "home_team": "France",
            "away_team": "Senegal"
        }],
        "entities": {
            "city": "East Rutherford",
            "date": "2026-06-16",
            "hotel_preference": None # SIMULATING MISSING PREFERENCE
        },
        "currency": "USD"
    }

    print(f"Input State Entities: {mock_state['entities']}")
    
    # Run Concierge
    result = concierge(mock_state)
    
    print("\n--- Result ---")
    print(f"Hotel Results (Should be empty): {result.get('hotel_results')}")
    print(f"LLM Response:\n{result.get('result')}")
    
    # Validation
    response_text = result.get('result', '').lower()
    if "prefer" in response_text or "cheapest" in response_text:
        print("\nSUCCESS: Agent asked for preference.")
    else:
        print("\nFAILURE: Agent did not ask for preference.")

if __name__ == "__main__":
    test_concierge_interaction()

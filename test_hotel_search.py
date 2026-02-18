
import os
import sys
import json
from dotenv import load_dotenv

# Add the project root to the python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), ".")))

load_dotenv()

from backend.app.agents.tools.hotel_search import search_hotels_for_match
from datetime import datetime, timedelta

# Setup sample dates
tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
day_after = (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d")

print(f"Searching for hotels in Seattle from {tomorrow} to {day_after}...")

# Call the function
try:
    results = search_hotels_for_match(
        match_city="Seattle",
        check_in=tomorrow,
        check_out=day_after,
        adults=1,
        currency="USD",
        max_results=40
    )
    
    print(f"\nSearch Results:")
    if isinstance(results, list):
        # Error case
        print(json.dumps(results, indent=2))
    else:
        print(f"Cheapest: {len(results.get('cheapest', []))}")
        print(json.dumps(results.get('cheapest', []), indent=2))
        print(f"\nNearest: {len(results.get('nearest', []))}")
        print(json.dumps(results.get('nearest', []), indent=2))
        print(f"\nBest Rated: {len(results.get('best_rated', []))}")




except Exception as e:
    print(f"Error: {e}")

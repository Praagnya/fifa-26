
import os
import sys
from dotenv import load_dotenv

# Add backend to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

load_dotenv()

from amadeus import Client

def check_hotel_counts():
    print("--- Checking Hotel Counts for FIFA Cities ---")
    
    api_key = os.getenv("AMADEUS_API_KEY")
    api_secret = os.getenv("AMADEUS_API_SECRET")
    
    if not api_key or not api_secret:
        print("Error: Missing Amadeus credentials")
        return

    client = Client(client_id=api_key, client_secret=api_secret)
    
    # Cities to check
    cities = {
        "New York (NYC)": "NYC",
        "Los Angeles (LAX)": "LAX",
        "Boston (BOS)": "BOS",
        "Mexico City (MEX)": "MEX",
        "Toronto (YYZ)": "YYZ",
        "Vancouver (YVR)": "YVR"
    }
    
    for name, code in cities.items():
        try:
            print(f"Checking {name}...")
            resp = client.reference_data.locations.hotels.by_city.get(cityCode=code)
            count = len(resp.data) if resp.data else 0
            print(f"  -> Found {count} hotels")
        except Exception as e:
            print(f"  -> Error: {e}")

if __name__ == "__main__":
    check_hotel_counts()

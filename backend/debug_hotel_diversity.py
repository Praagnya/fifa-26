
import os
import sys
import json
import random
from dotenv import load_dotenv

# Add backend to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

load_dotenv()

from amadeus import Client

def check_hotel_diversity():
    print("--- Checking Hotel Diversity ---")
    
    api_key = os.getenv("AMADEUS_API_KEY")
    api_secret = os.getenv("AMADEUS_API_SECRET")
    
    if not api_key or not api_secret:
        print("Error: Missing Amadeus credentials")
        return

    client = Client(client_id=api_key, client_secret=api_secret)
    
    # Search for hotels in Boston (BOS)
    print("Fetching hotels in Boston (BOS)...")
    try:
        hotel_list_resp = client.reference_data.locations.hotels.by_city.get(
            cityCode="BOS"
        )
        
        if not hotel_list_resp.data:
            print("No hotels found.")
            return

        all_hotels = hotel_list_resp.data
        print(f"Total Hotels Found: {len(all_hotels)}")
        
        print("\nTop 20 Hotels (Original Order):")
        for i, h in enumerate(all_hotels[:20]):
            print(f"{i+1}. {h.get('name')} (ID: {h.get('hotelId')})")
            
        # Check brand distribution in first 40
        brands = {}
        for h in all_hotels[:40]:
            name = h.get('name', '').lower()
            if "marriott" in name: brand = "Marriott"
            elif "hilton" in name: brand = "Hilton"
            elif "hyatt" in name: brand = "Hyatt"
            elif "ihg" in name or "holiday inn" in name: brand = "IHG"
            elif "best western" in name: brand = "Best Western"
            else: brand = "Other"
            brands[brand] = brands.get(brand, 0) + 1
            
        print("\nBrand Distribution (First 40):")
        for k, v in brands.items():
            print(f"{k}: {v}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_hotel_diversity()

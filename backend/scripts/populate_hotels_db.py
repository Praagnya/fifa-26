
import os
import sys
import json
import sqlite3
import time
from dotenv import load_dotenv

# Add backend to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

load_dotenv()

from amadeus import Client

DB_PATH = os.path.join(os.path.dirname(__file__), "../hotels.db")

# FIFA 2026 Host Cities
CITIES = {
    "Vancouver": "YVR",
    "Toronto": "YYZ",
    "Seattle": "SEA",
    "San Francisco": "SFO",
    "Los Angeles": "LAX",
    "Kansas City": "MCI",
    "Dallas": "DFW",
    "Atlanta": "ATL",
    "Houston": "IAH",
    "Boston": "BOS",
    "Philadelphia": "PHL",
    "Miami": "MIA",
    "New York/NJ": "NYC",
    "Mexico City": "MEX",
    "Monterrey": "MTY",
    "Guadalajara": "GDL"
}

def init_db():
    print(f"Initializing database at {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Create hotels table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS hotels (
        id TEXT PRIMARY KEY,
        name TEXT,
        city_code TEXT,
        latitude REAL,
        longitude REAL,
        address TEXT,
        rating REAL DEFAULT 0.0,
        description TEXT DEFAULT ''
    )
    ''')
    conn.commit()
    conn.close()

def populate_hotels():
    api_key = os.getenv("AMADEUS_API_KEY")
    api_secret = os.getenv("AMADEUS_API_SECRET")
    
    if not api_key or not api_secret:
        print("Error: Missing Amadeus credentials")
        return

    client = Client(client_id=api_key, client_secret=api_secret)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    total_added = 0
    
    for city_name, city_code in CITIES.items():
        print(f"Fetching hotels for {city_name} ({city_code})...")
        try:
            resp = client.reference_data.locations.hotels.by_city.get(cityCode=city_code)
            hotels = resp.data if resp.data else []
            
            print(f"  -> Found {len(hotels)} hotels. Inserting...")
            
            for h in hotels:
                h_id = h.get("hotelId")
                name = h.get("name")
                geo = h.get("geoCode", {})
                lat = geo.get("latitude")
                lon = geo.get("longitude")
                addr = json.dumps(h.get("address", {}))
                
                # Check if exists
                cursor.execute("SELECT id FROM hotels WHERE id=?", (h_id,))
                exists = cursor.fetchone()
                
                if not exists:
                    cursor.execute(
                        "INSERT INTO hotels (id, name, city_code, latitude, longitude, address) VALUES (?, ?, ?, ?, ?, ?)",
                        (h_id, name, city_code, lat, lon, addr)
                    )
                    total_added += 1
            
            conn.commit()
            time.sleep(0.5) # Be nice to API limits
            
        except Exception as e:
            print(f"  -> Error fetching {city_name}: {e}")

    print(f"\nDone! Total new hotels added: {total_added}")
    conn.close()

if __name__ == "__main__":
    init_db()
    populate_hotels()

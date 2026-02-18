import logging
import os
import time
import json
from amadeus import Client, ResponseError

logger = logging.getLogger(__name__)

_client: Client | None = None

# Hotel search results cache: key → (timestamp, results)
HOTEL_CACHE_TTL = 7200  # 2 hours
_hotel_cache: dict[str, tuple[float, list[dict]]] = {}

# Currency symbols (same as flight_search.py)
_CURRENCY_SYMBOLS: dict[str, str] = {
    "USD": "$", "EUR": "€", "GBP": "£", "JPY": "¥",
    "INR": "₹", "CAD": "C$", "AUD": "A$", "MXN": "MX$",
}

# IATA city codes for FIFA 2026 host cities
# IATA city codes for FIFA 2026 host cities
_CITY_CODES: dict[str, str] = {
    "vancouver": "YVR",
    "toronto": "YYZ",
    "seattle": "SEA",
    "inglewood": "LAX",
    "los angeles": "LAX",
    "santa clara": "SJC",
    "san francisco": "SFO",
    "houston": "IAH",
    "kansas city": "MCI",
    "arlington": "DFW",
    "dallas": "DFW",
    "atlanta": "ATL",
    "miami gardens": "MIA",
    "miami": "MIA",
    "philadelphia": "PHL",
    "foxborough": "BOS",
    "boston": "BOS",
    "east rutherford": "EWR",
    "new york": "NYC",
    "new jersey": "EWR",
    "mexico city": "MEX",
    "guadalupe": "MTY",
    "monterrey": "MTY",
    "zapopan": "GDL",
    "guadalajara": "GDL",
}

# Stadium coordinates (Lat, Lon) for the 16 host cities
_STADIUM_COORDS: dict[str, tuple[float, float]] = {
    "vancouver": (49.2767, -123.1120),       # BC Place
    "toronto": (43.6332, -79.4186),          # BMO Field
    "seattle": (47.5952, -122.3316),         # Lumen Field
    "los angeles": (33.9535, -118.3390),     # SoFi Stadium
    "inglewood": (33.9535, -118.3390),
    "san francisco": (37.4033, -121.9694),   # Levi's Stadium
    "santa clara": (37.4033, -121.9694),
    "houston": (29.6847, -95.4107),          # NRG Stadium
    "kansas city": (39.0489, -94.4839),      # Arrowhead Stadium
    "dallas": (32.7473, -97.0945),           # AT&T Stadium
    "arlington": (32.7473, -97.0945),
    "atlanta": (33.7554, -84.4008),          # Mercedes-Benz Stadium
    "miami": (25.9580, -80.2389),            # Hard Rock Stadium
    "miami gardens": (25.9580, -80.2389),
    "philadelphia": (39.9008, -75.1675),     # Lincoln Financial Field
    "boston": (42.0909, -71.2643),           # Gillette Stadium
    "foxborough": (42.0909, -71.2643),
    "new york": (40.8135, -74.0744),         # MetLife Stadium
    "new jersey": (40.8135, -74.0744),
    "east rutherford": (40.8135, -74.0744),
    "mexico city": (19.3029, -99.1505),      # Estadio Azteca
    "monterrey": (25.6690, -100.2445),       # Estadio BBVA
    "guadalupe": (25.6690, -100.2445),
    "guadalajara": (20.6817, -103.4626),     # Estadio Akron
    "zapopan": (20.6817, -103.4626),
}

import math

def _calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> str:
    """Haversine distance in km."""
    R = 6371  # Earth radius in km
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    
    a = math.sin(dphi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    d = R * c
    return f"{d:.1f} km"

def _get_distance_value(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine distance value in km."""
    R = 6371
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c



def _get_client() -> Client:
    global _client
    if _client is None:
        _client = Client(
            client_id=os.environ["AMADEUS_API_KEY"],
            client_secret=os.environ["AMADEUS_API_SECRET"],
        )
    return _client


def _resolve_city_code(city: str) -> str | None:
    """Resolve a city name to an IATA city code for hotel search."""
    key = city.lower().strip()
    if not key:
        return None

    # Check pre-seeded cache
    if key in _CITY_CODES:
        return _CITY_CODES[key]

    # Try Amadeus location search for the city
    try:
        client = _get_client()
        response = client.reference_data.locations.get(
            keyword=key,
            subType="CITY",
        )
        if response.data:
            code = response.data[0].get("iataCode")
            if code:
                _CITY_CODES[key] = code
                return code
    except (ResponseError, Exception):
        pass

    return None


import sqlite3

_DB_PATH = os.path.join(os.path.dirname(__file__), "../../../hotels.db")

def _get_db_connection():
    try:
        conn = sqlite3.connect(_DB_PATH)
        conn.row_factory = sqlite3.Row
        return conn
    except sqlite3.Error as e:
        logger.error(f"Database connection failed: {e}")
        return None

def _search_hotels_in_db(city_code: str, preference: str | None = None, stadium_coords: tuple[float, float] | None = None, limit: int = 40) -> list[dict]:
    """
    Search local SQLite DB for hotel candidates.
    Returns a list of dicts with 'id', 'name', 'distance_km', etc.
    """
    conn = _get_db_connection()
    if not conn:
        return []
    
    cursor = conn.cursor()
    
    try:
        # Basic query by city
        query = "SELECT * FROM hotels WHERE city_code = ?"
        params = [city_code]
        
        # We can sort by rating if available (currently 0.0, but structure is there)
        if preference == "best_rated":
            query += " ORDER BY rating DESC"
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        results = []
        for row in rows:
            h = dict(row)
            # Calculate distance if coords available
            dist_km = 9999.0
            if h['latitude'] and h['longitude'] and stadium_coords:
                dist_km = _get_distance_value(h['latitude'], h['longitude'], stadium_coords[0], stadium_coords[1])
            
            h['distance_to_stadium'] = dist_km
            results.append(h)
            
        # If preference is nearest, sort by calculated distance
        if preference == "nearest" and stadium_coords:
            results.sort(key=lambda x: x['distance_to_stadium'])
        elif preference == "best_rated":
            # Keep rating sort
            pass
        else:
            # Default: Random shuffle to avoid chain bias
            import random
            random.shuffle(results)
            
        return results[:limit]
        
    except sqlite3.Error as e:
        logger.error(f"DB Query failed: {e}")
        return []
    finally:
        conn.close()


def search_hotels_for_match(
    match_city: str,
    check_in: str,
    check_out: str,
    adults: int = 1,
    currency: str = "USD",
    preference: str | None = None,
    max_distance_miles: float | None = None,
    max_results: int = 10,
) -> list[dict]:
    """
    Search for hotels in a city using the Amadeus API.
    Two-step flow: Hotel List (get IDs by city) → Hotel Offers (get prices).

    Args:
        match_city: City name (e.g. "Los Angeles")
        check_in: Check-in date YYYY-MM-DD
        check_out: Check-out date YYYY-MM-DD
        adults: Number of adult guests
        currency: Currency code for pricing
        preference: "nearest", "cheapest", "best_rated" or None
        max_results: Maximum number of results to return

    Returns:
        List of hotel offer dicts.
    """
    # Check cache
    cache_key = f"{match_city}:{check_in}:{check_out}:{adults}:{currency}:{preference}:{max_distance_miles}"
    cached = _hotel_cache.get(cache_key)
    if cached and (time.time() - cached[0]) < HOTEL_CACHE_TTL:
        logger.info("Hotel cache HIT for key: %s", cache_key)
        return cached[1][:max_results]
    logger.info("Hotel cache MISS for key: %s", cache_key)

    city_code = _resolve_city_code(match_city)
    stadium_coords = _STADIUM_COORDS.get(match_city.lower(), None)
    
    if not city_code:
        return [{"error": f"Could not find city code for '{match_city}'."}]

    try:
        client = _get_client()
        hotel_ids = []

        # STRATEGY 1: NEAREST or distance-constrained (Geocode Search)
        if (preference == "nearest" or max_distance_miles) and stadium_coords:
            # Use tighter radius when user specified a distance constraint
            if max_distance_miles:
                radius_km = int(max_distance_miles / 0.621371) + 2  # add small buffer
                radius_km = max(5, min(radius_km, 100))
            else:
                radius_km = 20
            logger.info(f"Searching hotels NEAREST to stadium in {match_city} at {stadium_coords}, radius={radius_km}km")
            hotel_list_resp = client.reference_data.locations.hotels.by_geocode.get(
                latitude=stadium_coords[0],
                longitude=stadium_coords[1],
                radius=radius_km,
                radiusUnit="KM",
                hotelSource="ALL"
            )
        # STRATEGY 2: DEFAULT / CHEAPEST (City Search)
        else:
            logger.info(f"Searching hotels by CITY code {city_code}")
            hotel_list_resp = client.reference_data.locations.hotels.by_city.get(
                cityCode=city_code,
            )

        if not hotel_list_resp.data:
            return [{"error": f"No hotels found in {match_city}."}]

        # Randomize the full list to avoid chain bias (e.g. all Marriotts first)
        all_hotels = hotel_list_resp.data
        if preference != "nearest":
            # Only shuffle if NOT doing nearest search (as nearest is already sorted by distance)
            import random
            random.shuffle(all_hotels)

        # Take top hotel IDs (Amadeus limits to ~50 per offers call)
        # If geocode search "nearest", they are already sorted by distance!
        hotel_ids = [h["hotelId"] for h in all_hotels[:40]]

        # Step 2: Get offers for those hotels
        offers_resp = client.shopping.hotel_offers_search.get(
            hotelIds=hotel_ids,
            checkInDate=check_in,
            checkOutDate=check_out,
            adults=adults,
            currency=currency,
            view="FULL",
        )

        if not offers_resp.data:
            return {
                "cheapest": [],
                "nearest": [],
                "best_rated": [],
                "error": f"No hotel offers available in {match_city} for those dates."
            }

        # Calculate number of nights
        from datetime import datetime
        try:
            d_in = datetime.strptime(check_in, "%Y-%m-%d")
            d_out = datetime.strptime(check_out, "%Y-%m-%d")
            nights = (d_out - d_in).days
        except ValueError:
            nights = 1

        symbol = _CURRENCY_SYMBOLS.get(currency, "$")
        hotels = []
        
        # Get stadium coordinates for this city
        stadium_coords = _STADIUM_COORDS.get(match_city.lower(), None)

        for item in offers_resp.data:
            hotel_info = item.get("hotel", {})
            offers = item.get("offers", [])
            if not offers:
                continue
            
            offer = offers[0]  # Take the first (cheapest) offer
            price_info = offer.get("price", {})
            total = price_info.get("total", "0")
            curr = price_info.get("currency", currency)
            sym = _CURRENCY_SYMBOLS.get(curr, "$")

            try:
                total_float = float(total)
                per_night = total_float / max(nights, 1)
            except (ValueError, TypeError):
                total_float = 0
                per_night = 0

            # Extract address
            address_parts = []
            addr = hotel_info.get("address", {})
            if addr.get("lines"):
                address_parts.extend(addr["lines"])
            if addr.get("cityName"):
                address_parts.append(addr["cityName"])
            if addr.get("stateCode"):
                address_parts.append(addr["stateCode"])
            address = ", ".join(address_parts) if address_parts else ""

            # Coordinates
            lat = hotel_info.get("latitude") or hotel_info.get("geoCode", {}).get("latitude")
            lon = hotel_info.get("longitude") or hotel_info.get("geoCode", {}).get("longitude")
            
            # Distance logic
            distance_str = ""
            dist_val_km = 9999.0
            
            # 1. Prefer distance to Stadium if we have coords
            if lat and lon and stadium_coords:
                dist_val_km = _get_distance_value(lat, lon, stadium_coords[0], stadium_coords[1])
                dist_val_mi = dist_val_km * 0.621371
                distance_str = f"{dist_val_mi:.1f} miles from Stadium"
            # 2. Fallback to API distance (usually city center)
            else:
                distance_info = hotel_info.get("distance", {})
                if distance_info.get("value"):
                    distance_val = float(distance_info.get("value"))
                    distance_unit = distance_info.get("unit", "KM")
                    
                    if distance_unit == "KM":
                        dist_val_mi = distance_val * 0.621371
                        dist_val_km = distance_val
                    else:
                        dist_val_mi = distance_val
                        dist_val_km = distance_val / 0.621371 # approx
                    
                    distance_str = f"{dist_val_mi:.1f} miles from center"


            hotels.append({
                "hotel_name": hotel_info.get("name", "Unknown Hotel"),
                "hotel_id": hotel_info.get("hotelId", ""),
                "price_per_night": f"{sym}{per_night:.2f} {curr}",
                "total_price": f"{sym}{total_float:.2f} {curr}",
                "total_price_float": total_float, # internal for sorting
                "check_in": check_in,
                "check_out": check_out,
                "nights": nights,
                "distance": distance_str,
                "distance_km": dist_val_km,       # internal for sorting
                "address": address,
                "latitude": lat,
                "longitude": lon,
            })

        # --- Filter by max distance if specified ---
        if max_distance_miles is not None and max_distance_miles > 0:
            max_dist_km = max_distance_miles / 0.621371
            hotels = [h for h in hotels if h["distance_km"] <= max_dist_km]
            if not hotels:
                return [{"error": f"No hotels found within {max_distance_miles} miles of the stadium in {match_city}. Try increasing the distance or removing the distance filter."}]

        # --- Categorize ---

        # Cheapest: Ascending total_price
        cheapest_sorted = sorted(hotels, key=lambda h: h["total_price_float"])
        
        # Nearest: Ascending distance_km
        nearest_sorted = sorted(hotels, key=lambda h: h["distance_km"])
        
        # Best Rated: (Not available, return empty or dummy?)
        # For now, return empty and we explain in prompt.
        best_rated = []

        results = {
            "cheapest": cheapest_sorted[:5],
            "nearest": nearest_sorted[:5],
            "best_rated": best_rated, # Placeholder
        }

        # If user specified a preference, filter the final result to ONLY that category
        if preference == "cheapest":
            return cheapest_sorted[:5]
        elif preference == "nearest":
            return nearest_sorted[:5]
        elif preference == "best_rated":
            # For now return empty or simple list if we had data
            return best_rated[:5]
        
        # improved diversity by random shuffle mentioned earlier is implicit in 'hotels' list creation? 
        # No, we sort them above for the categories.
        # If no preference, we return the categorized dict for the UI/Agent to display sections.

        
        if hotels:
             _hotel_cache[cache_key] = (time.time(), results)

        return results

    except ResponseError as e:
        return {"error": f"Amadeus API error: {e}"}
    except Exception as e:
        return {"error": f"Hotel search failed: {e}"}


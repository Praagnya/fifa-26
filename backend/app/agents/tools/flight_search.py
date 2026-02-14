import json
import os
from datetime import datetime
from amadeus import Client, ResponseError
from openai import OpenAI

_client: Client | None = None

# Maps airline names (lowercase) → IATA carrier codes
_AIRLINE_TO_IATA: dict[str, str] = {
    "united": "UA", "american": "AA", "delta": "DL",
    "southwest": "WN", "jetblue": "B6", "alaska": "AS",
    "spirit": "NK", "frontier": "F9", "hawaiian": "HA",
    "sun country": "SY", "allegiant": "G4",
    "air canada": "AC", "westjet": "WS", "air transat": "TS", "porter": "PD",
    "avianca": "AV", "aeromexico": "AM", "copa": "CM", "latam": "LA",
    "aerolineas argentinas": "AR", "gol": "G3", "azul": "AD",
    "british airways": "BA", "lufthansa": "LH", "air france": "AF",
    "klm": "KL", "iberia": "IB", "ita airways": "AZ",
    "swiss": "LX", "austrian": "OS", "sas": "SK", "finnair": "AY",
    "tap portugal": "TP", "aer lingus": "EI", "virgin atlantic": "VS",
    "turkish": "TK", "turkish airlines": "TK",
    "emirates": "EK", "qatar": "QR", "qatar airways": "QR",
    "etihad": "EY", "singapore": "SQ", "singapore airlines": "SQ",
    "cathay pacific": "CX", "ana": "NH", "jal": "JL",
    "korean air": "KE", "asiana": "OZ", "qantas": "QF",
    "air new zealand": "NZ", "air india": "AI",
}

# Also allow the IATA codes themselves
_IATA_CODES = set(_AIRLINE_TO_IATA.values())


def _resolve_airline_code(raw: str | None) -> str | None:
    """Convert an airline name or code to a valid IATA carrier code."""
    if not raw:
        return None
    raw = raw.strip()
    # Already a valid 2-letter code
    if raw.upper() in _IATA_CODES:
        return raw.upper()
    # Lookup by name
    code = _AIRLINE_TO_IATA.get(raw.lower())
    if code:
        return code
    return None


def _get_client() -> Client:
    global _client
    if _client is None:
        _client = Client(
            client_id=os.environ["AMADEUS_API_KEY"],
            client_secret=os.environ["AMADEUS_API_SECRET"],
        )
    return _client


# Cache resolved lookups so we don't re-call the API for the same city
_iata_cache: dict[str, str] = {}


def _geocode_via_llm(city: str) -> tuple[float, float] | None:
    """Use OpenAI to get lat/lon for a city that Amadeus doesn't know."""
    try:
        client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Return ONLY a JSON object with latitude and longitude for the given city. Format: {\"lat\": 40.81, \"lon\": -74.07}. No other text."},
                {"role": "user", "content": city},
            ],
            temperature=0,
        )
        text = resp.choices[0].message.content.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0]
        data = json.loads(text)
        return (data["lat"], data["lon"])
    except Exception:
        return None


def _find_nearby_airport(city: str) -> str | None:
    """
    When a city has no airport in Amadeus, geocode it (try Amadeus first,
    then LLM fallback), then find the nearest airport by coordinates.
    """
    try:
        client = _get_client()
        lat, lon = None, None

        # Try Amadeus CITY geocode first
        try:
            city_resp = client.reference_data.locations.get(
                keyword=city,
                subType="CITY",
            )
            if city_resp.data:
                geo = city_resp.data[0].get("geoCode", {})
                lat = geo.get("latitude")
                lon = geo.get("longitude")
        except (ResponseError, Exception):
            pass

        # Fallback to LLM geocoding
        if lat is None or lon is None:
            coords = _geocode_via_llm(city)
            if coords:
                lat, lon = coords

        if lat is None or lon is None:
            return None

        # Find nearest airports by coordinates
        airport_resp = client.reference_data.locations.airports.get(
            latitude=lat,
            longitude=lon,
        )
        if airport_resp.data:
            return airport_resp.data[0]["iataCode"]
    except (ResponseError, Exception):
        pass

    return None


def resolve_iata(city: str) -> str | None:
    """
    Resolve a city name to an IATA airport code dynamically.
    1. Direct airport/city keyword search
    2. If no airport found, geocode the city and find the nearest airport
    """
    key = city.lower().strip()
    if not key:
        return None

    if key in _iata_cache:
        return _iata_cache[key]

    try:
        client = _get_client()
        response = client.reference_data.locations.get(
            keyword=key,
            subType="AIRPORT,CITY",
        )
        if response.data:
            # Prefer AIRPORT type over CITY
            for loc in response.data:
                if loc.get("subType") == "AIRPORT":
                    _iata_cache[key] = loc["iataCode"]
                    return _iata_cache[key]
            # First result is a CITY — use its code if it has one
            code = response.data[0].get("iataCode")
            if code:
                _iata_cache[key] = code
                return code
    except (ResponseError, Exception):
        pass

    # Fallback: geocode the city, then find the nearest airport
    nearby = _find_nearby_airport(key)
    if nearby:
        _iata_cache[key] = nearby
        return nearby

    return None


def search_flights(
    origin: str,
    destination: str,
    departure_date: str,
    adults: int = 1,
    max_results: int = 5,
    airline: str | None = None,
) -> list[dict]:
    """
    Search for flights using the Amadeus API.

    Args:
        origin: IATA code of departure airport (e.g. "JFK")
        destination: IATA code of arrival airport (e.g. "MIA")
        departure_date: Date in YYYY-MM-DD format
        adults: Number of adult passengers
        max_results: Maximum number of results to return
        airline: Optional IATA carrier code to filter results (e.g. "UA")

    Returns:
        List of flight offer dicts with price, airline, duration, stops info.
    """
    try:
        client = _get_client()
        params: dict = dict(
            originLocationCode=origin,
            destinationLocationCode=destination,
            departureDate=departure_date,
            adults=adults,
            max=max_results,
            currencyCode="USD",
        )
        resolved_airline = _resolve_airline_code(airline)
        if resolved_airline:
            params["includedAirlineCodes"] = resolved_airline
        
        response = client.shopping.flight_offers_search.get(**params)

        flights = []
        
        # FALLBACK: If specific airline search yields no results, try broader search
        if not response.data and resolved_airline:
            del params["includedAirlineCodes"]
            response = client.shopping.flight_offers_search.get(**params)
            # We could add a note to the first result or handle this in the scout node?
            # For now, just return the broad results so the user gets *something*.

        for offer in response.data:
            itinerary = offer["itineraries"][0]
            segments = itinerary["segments"]

            flights.append({
                "price": f"${offer['price']['total']} {offer['price']['currency']}",
                "airline": segments[0]["carrierCode"],
                "departure": segments[0]["departure"]["at"],
                "arrival": segments[-1]["arrival"]["at"],
                "duration": itinerary["duration"].replace("PT", "").lower(),
                "stops": len(segments) - 1,
                "segments": [
                    {
                        "from": seg["departure"]["iataCode"],
                        "to": seg["arrival"]["iataCode"],
                        "depart": seg["departure"]["at"],
                        "arrive": seg["arrival"]["at"],
                        "carrier": seg["carrierCode"],
                        "flight_number": seg["carrierCode"] + seg["number"],
                    }
                    for seg in segments
                ],
            })

        return flights

    except ResponseError as e:
        return [{"error": f"Amadeus API error: {e}"}]
    except Exception as e:
        return [{"error": f"Flight search failed: {e}"}]


def search_flights_for_match(
    departure_city: str,
    match_city: str,
    match_date: str,
    adults: int = 1,
    airline: str | None = None,
) -> list[dict]:
    """
    High-level helper: search flights from a user's city to a match city.
    Resolves city names to IATA codes automatically.
    """
    origin = resolve_iata(departure_city)
    destination = resolve_iata(match_city)

    if not origin:
        return [{"error": f"Could not find airport code for '{departure_city}'. Try providing a major city name."}]
    if not destination:
        return [{"error": f"Could not find airport code for match city '{match_city}'."}]

    # Validate date format, fall back to raw string if invalid
    try:
        datetime.strptime(match_date, "%Y-%m-%d")
    except ValueError:
        pass
    search_date = match_date

    return search_flights(
        origin=origin,
        destination=destination,
        departure_date=search_date,
        adults=adults,
        airline=airline,
    )

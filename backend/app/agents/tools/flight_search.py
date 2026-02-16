import json
import logging
import os
import time
from datetime import datetime
from amadeus import Client, ResponseError
from openai import OpenAI

logger = logging.getLogger(__name__)

_client: Client | None = None

# Flight search results cache: key → (timestamp, results)
FLIGHT_CACHE_TTL = 7200  # 2 hours
_flight_cache: dict[str, tuple[float, list[dict]]] = {}

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
# Pre-seed with FIFA 2026 host cities (Amadeus often can't resolve these)
_iata_cache: dict[str, str] = {
    "vancouver": "YVR",
    "toronto": "YYZ",
    "seattle": "SEA",
    "inglewood": "LAX",
    "santa clara": "SJC",
    "houston": "IAH",
    "kansas city": "MCI",
    "arlington": "DFW",
    "atlanta": "ATL",
    "miami gardens": "MIA",
    "miami": "MIA",
    "philadelphia": "PHL",
    "foxborough": "BOS",
    "boston": "BOS",
    "east rutherford": "EWR",
    "new york": "JFK",
    "mexico city": "MEX",
    "guadalupe": "MTY",
    "monterrey": "MTY",
    "zapopan": "GDL",
    "guadalajara": "GDL",
    "los angeles": "LAX",
    "san francisco": "SFO",
    "dallas": "DFW",
    "new jersey": "EWR",
}


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



# Pre-populated airport details cache — avoids per-request API calls for known airports.
# Format: {code: {name, detailedName, offset, tz, city}}
_airport_details_cache: dict[str, dict] = {
    # ── FIFA 2026 Host City Airports ──
    "YVR": {"name": "VANCOUVER INTL", "detailedName": "Vancouver International", "offset": "-08:00", "tz": "PT", "city": "Vancouver"},
    "YYZ": {"name": "LESTER B. PEARSON INTL", "detailedName": "Toronto Pearson International", "offset": "-05:00", "tz": "ET", "city": "Toronto"},
    "SEA": {"name": "SEATTLE-TACOMA INTL", "detailedName": "Seattle-Tacoma International", "offset": "-08:00", "tz": "PT", "city": "Seattle"},
    "LAX": {"name": "LOS ANGELES INTL", "detailedName": "Los Angeles International", "offset": "-08:00", "tz": "PT", "city": "Los Angeles"},
    "SJC": {"name": "NORMAN Y. MINETA SAN JOSE INTL", "detailedName": "San Jose International", "offset": "-08:00", "tz": "PT", "city": "San Jose"},
    "SFO": {"name": "SAN FRANCISCO INTL", "detailedName": "San Francisco International", "offset": "-08:00", "tz": "PT", "city": "San Francisco"},
    "IAH": {"name": "GEORGE BUSH INTERCONTINENTAL", "detailedName": "Houston George Bush Intercontinental", "offset": "-06:00", "tz": "CT", "city": "Houston"},
    "MCI": {"name": "KANSAS CITY INTL", "detailedName": "Kansas City International", "offset": "-06:00", "tz": "CT", "city": "Kansas City"},
    "DFW": {"name": "DALLAS/FORT WORTH INTL", "detailedName": "Dallas/Fort Worth International", "offset": "-06:00", "tz": "CT", "city": "Dallas"},
    "ATL": {"name": "HARTSFIELD-JACKSON ATLANTA INTL", "detailedName": "Hartsfield-Jackson Atlanta International", "offset": "-05:00", "tz": "ET", "city": "Atlanta"},
    "MIA": {"name": "MIAMI INTL", "detailedName": "Miami International", "offset": "-05:00", "tz": "ET", "city": "Miami"},
    "PHL": {"name": "PHILADELPHIA INTL", "detailedName": "Philadelphia International", "offset": "-05:00", "tz": "ET", "city": "Philadelphia"},
    "BOS": {"name": "LOGAN INTL", "detailedName": "Boston Logan International", "offset": "-05:00", "tz": "ET", "city": "Boston"},
    "EWR": {"name": "NEWARK LIBERTY INTL", "detailedName": "Newark Liberty International", "offset": "-05:00", "tz": "ET", "city": "Newark"},
    "JFK": {"name": "JOHN F. KENNEDY INTL", "detailedName": "John F. Kennedy International", "offset": "-05:00", "tz": "ET", "city": "New York"},
    "MEX": {"name": "BENITO JUAREZ INTL", "detailedName": "Mexico City Benito Juarez International", "offset": "-06:00", "tz": "CT", "city": "Mexico City"},
    "MTY": {"name": "MONTERREY INTL", "detailedName": "Monterrey International", "offset": "-06:00", "tz": "CT", "city": "Monterrey"},
    "GDL": {"name": "DON MIGUEL HIDALGO Y COSTILLA INTL", "detailedName": "Guadalajara International", "offset": "-06:00", "tz": "CT", "city": "Guadalajara"},
    # ── Major US Hubs (common connecting airports) ──
    "ORD": {"name": "O'HARE INTL", "detailedName": "Chicago O'Hare International", "offset": "-06:00", "tz": "CT", "city": "Chicago"},
    "DEN": {"name": "DENVER INTL", "detailedName": "Denver International", "offset": "-07:00", "tz": "MT", "city": "Denver"},
    "PHX": {"name": "SKY HARBOR INTL", "detailedName": "Phoenix Sky Harbor International", "offset": "-07:00", "tz": "MT", "city": "Phoenix"},
    "MSP": {"name": "MINNEAPOLIS-ST PAUL INTL", "detailedName": "Minneapolis-St Paul International", "offset": "-06:00", "tz": "CT", "city": "Minneapolis"},
    "DTW": {"name": "DETROIT METROPOLITAN WAYNE COUNTY", "detailedName": "Detroit Metropolitan", "offset": "-05:00", "tz": "ET", "city": "Detroit"},
    "CLT": {"name": "CHARLOTTE DOUGLAS INTL", "detailedName": "Charlotte Douglas International", "offset": "-05:00", "tz": "ET", "city": "Charlotte"},
    "LAS": {"name": "HARRY REID INTL", "detailedName": "Las Vegas Harry Reid International", "offset": "-08:00", "tz": "PT", "city": "Las Vegas"},
    "MCO": {"name": "ORLANDO INTL", "detailedName": "Orlando International", "offset": "-05:00", "tz": "ET", "city": "Orlando"},
    "FLL": {"name": "FORT LAUDERDALE-HOLLYWOOD INTL", "detailedName": "Fort Lauderdale-Hollywood International", "offset": "-05:00", "tz": "ET", "city": "Fort Lauderdale"},
    "IAD": {"name": "WASHINGTON DULLES INTL", "detailedName": "Washington Dulles International", "offset": "-05:00", "tz": "ET", "city": "Washington"},
    "DCA": {"name": "RONALD REAGAN WASHINGTON NATIONAL", "detailedName": "Washington Reagan National", "offset": "-05:00", "tz": "ET", "city": "Washington"},
    "SLC": {"name": "SALT LAKE CITY INTL", "detailedName": "Salt Lake City International", "offset": "-07:00", "tz": "MT", "city": "Salt Lake City"},
    "SAN": {"name": "SAN DIEGO INTL", "detailedName": "San Diego International", "offset": "-08:00", "tz": "PT", "city": "San Diego"},
    "PDX": {"name": "PORTLAND INTL", "detailedName": "Portland International", "offset": "-08:00", "tz": "PT", "city": "Portland"},
    "BWI": {"name": "BALTIMORE/WASHINGTON INTL", "detailedName": "Baltimore/Washington International", "offset": "-05:00", "tz": "ET", "city": "Baltimore"},
    "TPA": {"name": "TAMPA INTL", "detailedName": "Tampa International", "offset": "-05:00", "tz": "ET", "city": "Tampa"},
    "BNA": {"name": "NASHVILLE INTL", "detailedName": "Nashville International", "offset": "-06:00", "tz": "CT", "city": "Nashville"},
    "AUS": {"name": "AUSTIN-BERGSTROM INTL", "detailedName": "Austin-Bergstrom International", "offset": "-06:00", "tz": "CT", "city": "Austin"},
    "RDU": {"name": "RALEIGH-DURHAM INTL", "detailedName": "Raleigh-Durham International", "offset": "-05:00", "tz": "ET", "city": "Raleigh"},
    "STL": {"name": "ST LOUIS LAMBERT INTL", "detailedName": "St Louis Lambert International", "offset": "-06:00", "tz": "CT", "city": "St Louis"},
    "HNL": {"name": "DANIEL K. INOUYE INTL", "detailedName": "Honolulu Daniel K. Inouye International", "offset": "-10:00", "tz": "HT", "city": "Honolulu"},
    # ── Major Canadian Hubs ──
    "YYC": {"name": "CALGARY INTL", "detailedName": "Calgary International", "offset": "-07:00", "tz": "MT", "city": "Calgary"},
    "YUL": {"name": "PIERRE ELLIOTT TRUDEAU INTL", "detailedName": "Montreal Trudeau International", "offset": "-05:00", "tz": "ET", "city": "Montreal"},
    "YOW": {"name": "OTTAWA MACDONALD-CARTIER INTL", "detailedName": "Ottawa Macdonald-Cartier International", "offset": "-05:00", "tz": "ET", "city": "Ottawa"},
    "YEG": {"name": "EDMONTON INTL", "detailedName": "Edmonton International", "offset": "-07:00", "tz": "MT", "city": "Edmonton"},
    "YWG": {"name": "WINNIPEG JAMES ARMSTRONG RICHARDSON INTL", "detailedName": "Winnipeg International", "offset": "-06:00", "tz": "CT", "city": "Winnipeg"},
    # ── Major International Hubs (common connections) ──
    "LHR": {"name": "HEATHROW", "detailedName": "London Heathrow", "offset": "+00:00", "tz": "GMT/BST", "city": "London"},
    "CDG": {"name": "CHARLES DE GAULLE", "detailedName": "Paris Charles de Gaulle", "offset": "+01:00", "tz": "CET/CEST", "city": "Paris"},
    "FRA": {"name": "FRANKFURT INTL", "detailedName": "Frankfurt International", "offset": "+01:00", "tz": "CET/CEST", "city": "Frankfurt"},
    "AMS": {"name": "SCHIPHOL", "detailedName": "Amsterdam Schiphol", "offset": "+01:00", "tz": "CET/CEST", "city": "Amsterdam"},
    "MAD": {"name": "ADOLFO SUAREZ MADRID-BARAJAS", "detailedName": "Madrid Barajas", "offset": "+01:00", "tz": "CET/CEST", "city": "Madrid"},
    "IST": {"name": "ISTANBUL AIRPORT", "detailedName": "Istanbul Airport", "offset": "+03:00", "tz": "TRT", "city": "Istanbul"},
    "DXB": {"name": "DUBAI INTL", "detailedName": "Dubai International", "offset": "+04:00", "tz": "GST", "city": "Dubai"},
    "DOH": {"name": "HAMAD INTL", "detailedName": "Doha Hamad International", "offset": "+03:00", "tz": "AST", "city": "Doha"},
    "NRT": {"name": "NARITA INTL", "detailedName": "Tokyo Narita International", "offset": "+09:00", "tz": "JST", "city": "Tokyo"},
    "HND": {"name": "HANEDA", "detailedName": "Tokyo Haneda", "offset": "+09:00", "tz": "JST", "city": "Tokyo"},
    "ICN": {"name": "INCHEON INTL", "detailedName": "Seoul Incheon International", "offset": "+09:00", "tz": "KST", "city": "Seoul"},
    "SIN": {"name": "CHANGI", "detailedName": "Singapore Changi", "offset": "+08:00", "tz": "SGT", "city": "Singapore"},
    "HKG": {"name": "HONG KONG INTL", "detailedName": "Hong Kong International", "offset": "+08:00", "tz": "HKT", "city": "Hong Kong"},
    "DEL": {"name": "INDIRA GANDHI INTL", "detailedName": "Delhi Indira Gandhi International", "offset": "+05:30", "tz": "IST", "city": "Delhi"},
    "BOM": {"name": "CHHATRAPATI SHIVAJI MAHARAJ INTL", "detailedName": "Mumbai Chhatrapati Shivaji International", "offset": "+05:30", "tz": "IST", "city": "Mumbai"},
    "GRU": {"name": "GUARULHOS INTL", "detailedName": "Sao Paulo Guarulhos International", "offset": "-03:00", "tz": "BRT", "city": "Sao Paulo"},
    "BOG": {"name": "EL DORADO INTL", "detailedName": "Bogota El Dorado International", "offset": "-05:00", "tz": "COT", "city": "Bogota"},
    "PTY": {"name": "TOCUMEN INTL", "detailedName": "Panama City Tocumen International", "offset": "-05:00", "tz": "EST", "city": "Panama City"},
    "CUN": {"name": "CANCUN INTL", "detailedName": "Cancun International", "offset": "-05:00", "tz": "EST", "city": "Cancun"},
    "LIM": {"name": "JORGE CHAVEZ INTL", "detailedName": "Lima Jorge Chavez International", "offset": "-05:00", "tz": "PET", "city": "Lima"},
    "SCL": {"name": "ARTURO MERINO BENITEZ INTL", "detailedName": "Santiago International", "offset": "-04:00", "tz": "CLT", "city": "Santiago"},
    "EZE": {"name": "MINISTRO PISTARINI INTL", "detailedName": "Buenos Aires Ezeiza International", "offset": "-03:00", "tz": "ART", "city": "Buenos Aires"},
    "SYD": {"name": "KINGSFORD SMITH", "detailedName": "Sydney Kingsford Smith", "offset": "+11:00", "tz": "AEDT", "city": "Sydney"},
    "AKL": {"name": "AUCKLAND INTL", "detailedName": "Auckland International", "offset": "+13:00", "tz": "NZDT", "city": "Auckland"},
    "JNB": {"name": "O.R. TAMBO INTL", "detailedName": "Johannesburg O.R. Tambo International", "offset": "+02:00", "tz": "SAST", "city": "Johannesburg"},
    "ADD": {"name": "BOLE INTL", "detailedName": "Addis Ababa Bole International", "offset": "+03:00", "tz": "EAT", "city": "Addis Ababa"},
}

def _get_timezone_label(offset: str, country: str) -> str:
    """Best-effort mapping of offset+country to timezone code."""
    if not offset:
        return ""

    # Normalize offset
    if "Z" in offset:
        return "UTC"

    # ── Country-specific mappings ──
    _COUNTRY_TZ: dict[str, dict[str, str]] = {
        # South Asia
        "IN": {"+05:30": "IST"},
        "PK": {"+05:00": "PKT"},
        "BD": {"+06:00": "BST"},
        "LK": {"+05:30": "SLST"},
        "NP": {"+05:45": "NPT"},
        # East Asia
        "CN": {"+08:00": "CST"},
        "HK": {"+08:00": "HKT"},
        "TW": {"+08:00": "CST"},
        "JP": {"+09:00": "JST"},
        "KR": {"+09:00": "KST"},
        # Southeast Asia
        "SG": {"+08:00": "SGT"},
        "MY": {"+08:00": "MYT"},
        "TH": {"+07:00": "ICT"},
        "VN": {"+07:00": "ICT"},
        "ID": {"+07:00": "WIB", "+08:00": "WITA", "+09:00": "WIT"},
        "PH": {"+08:00": "PHT"},
        # Middle East
        "AE": {"+04:00": "GST"},
        "SA": {"+03:00": "AST"},
        "QA": {"+03:00": "AST"},
        "TR": {"+03:00": "TRT"},
        "IR": {"+03:30": "IRST"},
        "IL": {"+02:00": "IST", "+03:00": "IDT"},
        # Africa
        "ZA": {"+02:00": "SAST"},
        "KE": {"+03:00": "EAT"},
        "ET": {"+03:00": "EAT"},
        "NG": {"+01:00": "WAT"},
        "EG": {"+02:00": "EET"},
        # Oceania
        "AU": {"+10:00": "AEST", "+11:00": "AEDT", "+08:00": "AWST", "+09:30": "ACST"},
        "NZ": {"+12:00": "NZST", "+13:00": "NZDT"},
        # South America
        "BR": {"-03:00": "BRT"},
        "AR": {"-03:00": "ART"},
        "CL": {"-04:00": "CLT", "-03:00": "CLST"},
        "CO": {"-05:00": "COT"},
        "PE": {"-05:00": "PET"},
        # UK / Ireland
        "GB": {"+00:00": "GMT", "+01:00": "BST"},
        "IE": {"+00:00": "GMT", "+01:00": "IST"},
        # Russia
        "RU": {"+03:00": "MSK", "+05:00": "YEKT", "+07:00": "KRAT", "+09:00": "YAKT", "+10:00": "VLAT"},
    }

    if country in _COUNTRY_TZ:
        for off, label in _COUNTRY_TZ[country].items():
            if off in offset:
                return label

    # US / Canada / Mexico
    if country in ("US", "CA", "MX"):
        if "-05:00" in offset or "-04:00" in offset: return "ET"
        if "-06:00" in offset or "-05:00" in offset: return "CT"
        if "-07:00" in offset or "-06:00" in offset: return "MT"
        if "-08:00" in offset or "-07:00" in offset: return "PT"
        if "-10:00" in offset: return "HT"

    # Europe (generic)
    if "+01:00" in offset or "+02:00" in offset: return "CET/CEST"
    if "+00:00" in offset: return "GMT"

    # Fallback to offset
    return f"UTC{offset}"


def _get_airport_details(iata_code: str) -> dict:
    """Fetch name and timezone for an airport."""
    if iata_code in _airport_details_cache:
        return _airport_details_cache[iata_code]
    
    try:
        client = _get_client()
        response = client.reference_data.locations.get(
            keyword=iata_code,
            subType="AIRPORT"
        )
        if response.data:
            loc = response.data[0]
            offset = loc.get("timeZoneOffset", "")
            country = loc.get("address", {}).get("countryCode", "")
            
            details = {
                "name": loc.get("name", iata_code),
                "detailedName": loc.get("detailedName", iata_code),
                "offset": offset,
                "tz": _get_timezone_label(offset, country),
                "city": loc.get("address", {}).get("cityName", ""),
            }
            _airport_details_cache[iata_code] = details
            return details
    except Exception:
        pass
    
    # Fallback
    fallback = {
        "name": iata_code, 
        "detailedName": iata_code, 
        "offset": "", 
        "tz": "", 
        "city": ""
    }
    _airport_details_cache[iata_code] = fallback
    return fallback


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
                    code = loc["iataCode"]
                    _iata_cache[key] = code
                    # Also populate details cache while we're here
                    offset = loc.get("timeZoneOffset", "")
                    country = loc.get("address", {}).get("countryCode", "")
                    _airport_details_cache[code] = {
                        "name": loc.get("name", code),
                        "detailedName": loc.get("detailedName", code),
                        "offset": offset,
                        "tz": _get_timezone_label(offset, country),
                        "city": loc.get("address", {}).get("cityName", ""),
                    }
                    return code
            
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
    max_results: int = 10,
    airline: str | None = None,
    currency: str = "USD",
    nonstop: bool = False,
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
        currency: Currency code for pricing (e.g. "USD", "EUR")
        nonstop: If True, only return nonstop/direct flights

    Returns:
        List of flight offer dicts with price, airline, duration, stops info.
    """
    # Check flight cache
    cache_key = f"{origin}:{destination}:{departure_date}:{currency}:{nonstop}:{airline or 'any'}"
    cached = _flight_cache.get(cache_key)
    if cached and (time.time() - cached[0]) < FLIGHT_CACHE_TTL:
        logger.info("Cache HIT for key: %s", cache_key)
        return cached[1][:max_results]
    logger.info("Cache MISS for key: %s", cache_key)

    try:
        client = _get_client()
        # Overfetch to allow filtering out wrong airports, then trim to max_results
        fetch_count = max_results * 2
        params: dict = dict(
            originLocationCode=origin,
            destinationLocationCode=destination,
            departureDate=departure_date,
            adults=adults,
            max=fetch_count,
            currencyCode=currency,
            nonStop="true" if nonstop else "false",
        )
        resolved_airline = _resolve_airline_code(airline)
        if resolved_airline:
            params["includedAirlineCodes"] = resolved_airline
        
        response = client.shopping.flight_offers_search.get(**params)

        # First pass: filter to only exact airport matches
        valid_offers = []
        for offer in response.data:
            segments = offer["itineraries"][0]["segments"]
            if segments[0]["departure"]["iataCode"] != origin:
                continue
            if segments[-1]["arrival"]["iataCode"] != destination:
                continue
            valid_offers.append(offer)
            if len(valid_offers) >= max_results:
                break

        flights = []

        for offer in valid_offers:
            itinerary = offer["itineraries"][0]
            segments = itinerary["segments"]

            # Extract aircraft from first segment
            aircraft_code = segments[0].get("aircraft", {}).get("code", "")
            
            # Enrich segments
            enriched_segments = []
            for seg in segments:
                dep_code = seg["departure"]["iataCode"]
                arr_code = seg["arrival"]["iataCode"]
                
                # We need details properly. Let's rely on a helper function we'll add.
                dep_info = _get_airport_details(dep_code)
                arr_info = _get_airport_details(arr_code)

                enriched_segments.append({
                    "from": dep_code,
                    "from_name": dep_info.get("name", dep_code),
                    "from_tz": dep_info.get("tz", ""),
                    "to": arr_code,
                    "to_name": arr_info.get("name", arr_code),
                    "to_tz": arr_info.get("tz", ""),
                    "depart": seg["departure"]["at"],
                    "arrive": seg["arrival"]["at"],
                    "carrier": seg["carrierCode"],
                    "flight_number": seg["carrierCode"] + seg["number"],
                    "aircraft": seg.get("aircraft", {}).get("code", ""),
                })

            # Format price with correct symbol
            currency_code = offer['price']['currency']
            total = offer['price']['total']
            symbol = "$"
            if currency_code == "EUR": symbol = "€"
            elif currency_code == "GBP": symbol = "£"
            elif currency_code == "JPY": symbol = "¥"
            elif currency_code == "INR": symbol = "₹"
            elif currency_code == "CAD": symbol = "C$"
            elif currency_code == "AUD": symbol = "A$"
            
            flights.append({
                "price": f"{symbol}{total} {currency_code}",
                "airline": segments[0]["carrierCode"],
                "departure": segments[0]["departure"]["at"],
                "arrival": segments[-1]["arrival"]["at"],
                "duration": itinerary["duration"].replace("PT", "").lower(),
                "stops": len(segments) - 1,
                "aircraft": aircraft_code,
                "segments": enriched_segments,
            })

        if flights:
            _flight_cache[cache_key] = (time.time(), flights)

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
    currency: str = "USD",
    nonstop: bool = False,
    max_results: int = 10,
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
        currency=currency,
        nonstop=nonstop,
        max_results=max_results,
    )

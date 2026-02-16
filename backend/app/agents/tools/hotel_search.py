import logging
import os
import time
from amadeus import Client, ResponseError

logger = logging.getLogger(__name__)

_client: Client | None = None

# Hotel search results cache: key → (timestamp, results)
HOTEL_CACHE_TTL = 7200  # 2 hours
_hotel_cache: dict[str, tuple[float, list[dict]]] = {}

# Currency symbols (same as flight_search.py)
_CURRENCY_SYMBOLS: dict[str, str] = {
    "USD": "$", "EUR": "€", "GBP": "£", "JPY": "¥",
    "INR": "₹", "CAD": "C$", "AUD": "A$",
}

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


def search_hotels_for_match(
    match_city: str,
    check_in: str,
    check_out: str,
    adults: int = 1,
    currency: str = "USD",
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
        max_results: Maximum number of results to return

    Returns:
        List of hotel offer dicts.
    """
    # Check cache
    cache_key = f"{match_city}:{check_in}:{check_out}:{adults}:{currency}"
    cached = _hotel_cache.get(cache_key)
    if cached and (time.time() - cached[0]) < HOTEL_CACHE_TTL:
        logger.info("Hotel cache HIT for key: %s", cache_key)
        return cached[1][:max_results]
    logger.info("Hotel cache MISS for key: %s", cache_key)

    city_code = _resolve_city_code(match_city)
    if not city_code:
        return [{"error": f"Could not find city code for '{match_city}'."}]

    try:
        client = _get_client()

        # Step 1: Get hotel IDs by city
        hotel_list_resp = client.reference_data.locations.hotels.by_city.get(
            cityCode=city_code,
        )

        if not hotel_list_resp.data:
            return [{"error": f"No hotels found in {match_city}."}]

        # Take top hotel IDs (Amadeus limits to ~50 per offers call)
        hotel_ids = [h["hotelId"] for h in hotel_list_resp.data[:40]]

        # Step 2: Get offers for those hotels
        offers_resp = client.shopping.hotel_offers_search.get(
            hotelIds=hotel_ids,
            checkInDate=check_in,
            checkOutDate=check_out,
            adults=adults,
            currency=currency,
        )

        if not offers_resp.data:
            return [{"error": f"No hotel offers available in {match_city} for those dates."}]

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

            # Distance
            distance_info = hotel_info.get("distance", {})
            distance_val = distance_info.get("value")
            distance_unit = distance_info.get("unit", "KM")
            distance_str = ""
            if distance_val is not None:
                unit_label = "km" if distance_unit == "KM" else "mi"
                distance_str = f"{distance_val} {unit_label}"

            # Coordinates
            lat = hotel_info.get("latitude") or hotel_info.get("geoCode", {}).get("latitude")
            lon = hotel_info.get("longitude") or hotel_info.get("geoCode", {}).get("longitude")

            hotels.append({
                "hotel_name": hotel_info.get("name", "Unknown Hotel"),
                "hotel_id": hotel_info.get("hotelId", ""),
                "price_per_night": f"{sym}{per_night:.2f} {curr}",
                "total_price": f"{sym}{total_float:.2f} {curr}",
                "check_in": check_in,
                "check_out": check_out,
                "nights": nights,
                "distance": distance_str,
                "address": address,
                "latitude": lat,
                "longitude": lon,
            })

        # Sort by total price
        hotels.sort(key=lambda h: float(h["total_price"].split()[0].replace("$", "").replace("€", "").replace("£", "").replace("¥", "").replace("₹", "").replace("C", "").replace("A", "")) if h["total_price"] else 0)

        if hotels:
            _hotel_cache[cache_key] = (time.time(), hotels)

        return hotels[:max_results]

    except ResponseError as e:
        return [{"error": f"Amadeus API error: {e}"}]
    except Exception as e:
        return [{"error": f"Hotel search failed: {e}"}]

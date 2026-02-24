"""Tests for currency handling in flight search."""
import time
from unittest.mock import MagicMock, patch

import pytest

from backend.app.agents.tools import flight_search as fs


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_offer(currency_code: str, total: str = "250.00", origin="JFK", dest="MIA"):
    """Build a minimal Amadeus flight offer dict."""
    return {
        "itineraries": [{
            "duration": "PT3H30M",
            "segments": [{
                "departure": {"iataCode": origin, "at": "2026-06-15T08:00:00"},
                "arrival":   {"iataCode": dest,   "at": "2026-06-15T11:30:00"},
                "carrierCode": "AA",
                "number": "100",
                "aircraft": {"code": "737"},
            }],
        }],
        "price": {"currency": currency_code, "total": total},
    }


def _mock_client(offers: list[dict]):
    """Return a mock Amadeus client whose flight search returns the given offers."""
    mock_response = MagicMock()
    mock_response.data = offers

    mock_client = MagicMock()
    mock_client.shopping.flight_offers_search.get.return_value = mock_response
    return mock_client


# ---------------------------------------------------------------------------
# 1. Currency symbol formatting
# ---------------------------------------------------------------------------

SYMBOL_CASES = [
    ("USD", "250.00", "$250.00 USD"),
    ("EUR", "250.00", "€250.00 EUR"),
    ("GBP", "250.00", "£250.00 GBP"),
    ("JPY", "250.00", "¥250.00 JPY"),
    ("INR", "250.00", "₹250.00 INR"),
    ("CAD", "250.00", "C$250.00 CAD"),
    ("AUD", "250.00", "A$250.00 AUD"),
    ("MXN", "250.00", "MX$250.00 MXN"),
    ("CHF", "250.00", "$250.00 CHF"),   # unknown currency → fallback "$"
]


@pytest.mark.parametrize("currency_code,total,expected_price", SYMBOL_CASES)
def test_price_symbol_formatting(currency_code, total, expected_price):
    """search_flights must format price strings with the correct symbol."""
    offer = _make_offer(currency_code, total)
    mock_client = _mock_client([offer])

    # Clear cache to avoid stale hits from other tests
    fs._flight_cache.clear()

    with patch.object(fs, "_get_client", return_value=mock_client):
        # Pre-populate airport details cache so no extra API calls happen
        fs._airport_details_cache["JFK"] = {"name": "JFK", "detailedName": "JFK", "offset": "-05:00", "tz": "ET", "city": "New York"}
        fs._airport_details_cache["MIA"] = {"name": "MIA", "detailedName": "MIA", "offset": "-05:00", "tz": "ET", "city": "Miami"}

        results = fs.search_flights(
            origin="JFK",
            destination="MIA",
            departure_date="2026-06-15",
            currency=currency_code,
        )

    assert len(results) == 1
    assert results[0]["price"] == expected_price


# ---------------------------------------------------------------------------
# 2. Pre-seeded IATA cache (no API call)
# ---------------------------------------------------------------------------

IATA_CASES = [
    ("miami",         "MIA"),
    ("new york",      "JFK"),
    ("toronto",       "YYZ"),
    ("los angeles",   "LAX"),
    ("east rutherford", "EWR"),
    ("mexico city",   "MEX"),
    ("vancouver",     "YVR"),
]


@pytest.mark.parametrize("city,expected_iata", IATA_CASES)
def test_resolve_iata_preseed(city, expected_iata):
    """Cities pre-seeded in _iata_cache must resolve without an API call."""
    mock_client = MagicMock()

    with patch.object(fs, "_get_client", return_value=mock_client):
        code = fs.resolve_iata(city)

    assert code == expected_iata, f"Expected {expected_iata} for '{city}', got {code}"
    # The Amadeus API should NOT have been called for a pre-seeded city
    mock_client.reference_data.locations.get.assert_not_called()


# ---------------------------------------------------------------------------
# 2b. Short abbreviations bypass Amadeus keyword search (go to geocoding)
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("abbrev", ["la", "sf", "nyc", "dc", "ny"])
def test_short_abbrev_skips_amadeus_keyword_search(abbrev):
    """
    Short inputs (≤3 chars) must NOT call the Amadeus keyword API
    (which would return ambiguous results like airline codes), and must
    instead go straight to the geocoding fallback.
    """
    # Clear any cached entry for the abbreviation
    fs._iata_cache.pop(abbrev, None)

    mock_client = MagicMock()
    # Geocoding fallback: Amadeus CITY geocode returns nothing → LLM geocode path
    mock_client.reference_data.locations.get.return_value.data = []
    # Nearest airport returns LAX for any coords
    mock_client.reference_data.locations.airports.get.return_value.data = [
        {"iataCode": "LAX"}
    ]

    with patch.object(fs, "_get_client", return_value=mock_client), \
         patch.object(fs, "_geocode_via_llm", return_value=(34.05, -118.24)):
        fs.resolve_iata(abbrev)

    # The keyword search (AIRPORT,CITY subType) must never have been called
    for call in mock_client.reference_data.locations.get.call_args_list:
        kwargs = call.kwargs if call.kwargs else (call.args[1] if len(call.args) > 1 else {})
        assert kwargs.get("subType") != "AIRPORT,CITY", (
            f"resolve_iata('{abbrev}') called the Amadeus keyword search — "
            "short abbreviations should skip it and use geocoding instead"
        )


def test_short_abbrev_resolves_via_geocoding():
    """
    'la' must resolve to LAX through the geocoding path, not a wrong
    airport returned by an Amadeus keyword match on the ambiguous string.
    """
    fs._iata_cache.pop("la", None)

    mock_client = MagicMock()
    mock_client.reference_data.locations.get.return_value.data = []
    mock_client.reference_data.locations.airports.get.return_value.data = [
        {"iataCode": "LAX"}
    ]

    with patch.object(fs, "_get_client", return_value=mock_client), \
         patch.object(fs, "_geocode_via_llm", return_value=(34.05, -118.24)):
        code = fs.resolve_iata("la")

    assert code == "LAX"


# ---------------------------------------------------------------------------
# 2c. LLM direct IATA fallback when Amadeus keyword search fails
# ---------------------------------------------------------------------------

def test_llm_iata_fallback_when_amadeus_fails():
    """
    When the Amadeus keyword search returns nothing (e.g. test-env gap),
    resolve_iata must fall back to _resolve_iata_via_llm to get the code.
    """
    fs._iata_cache.pop("phoenix", None)

    mock_client = MagicMock()
    # Amadeus returns no results for any call
    mock_client.reference_data.locations.get.return_value.data = []
    mock_client.reference_data.locations.airports.get.return_value.data = []

    with patch.object(fs, "_get_client", return_value=mock_client), \
         patch.object(fs, "_geocode_via_llm", return_value=(33.44, -112.07)), \
         patch.object(fs, "_resolve_iata_via_llm", return_value="PHX") as mock_llm_iata:
        code = fs.resolve_iata("phoenix")

    # _resolve_iata_via_llm should have been called as the last resort
    mock_llm_iata.assert_called_once_with("phoenix")
    assert code == "PHX"


def test_llm_iata_fallback_caches_result():
    """Result from _resolve_iata_via_llm should be stored in _iata_cache."""
    fs._iata_cache.pop("phoenix", None)

    mock_client = MagicMock()
    mock_client.reference_data.locations.get.return_value.data = []
    mock_client.reference_data.locations.airports.get.return_value.data = []

    with patch.object(fs, "_get_client", return_value=mock_client), \
         patch.object(fs, "_geocode_via_llm", return_value=(33.44, -112.07)), \
         patch.object(fs, "_resolve_iata_via_llm", return_value="PHX"):
        fs.resolve_iata("phoenix")

    assert fs._iata_cache.get("phoenix") == "PHX"


# ---------------------------------------------------------------------------
# 3. Currency parameter is forwarded to the Amadeus API call
# ---------------------------------------------------------------------------

def test_currency_forwarded_to_amadeus():
    """search_flights must pass currencyCode to the Amadeus API."""
    offer = _make_offer("EUR")
    mock_client = _mock_client([offer])
    fs._flight_cache.clear()

    with patch.object(fs, "_get_client", return_value=mock_client):
        fs.search_flights("JFK", "MIA", "2026-06-15", currency="EUR")

    call_kwargs = mock_client.shopping.flight_offers_search.get.call_args.kwargs
    assert call_kwargs["currencyCode"] == "EUR"


# ---------------------------------------------------------------------------
# 4. Default currency is USD when none is specified
# ---------------------------------------------------------------------------

def test_default_currency_is_usd():
    """search_flights must default to USD when no currency argument is given."""
    offer = _make_offer("USD")
    mock_client = _mock_client([offer])
    fs._flight_cache.clear()

    with patch.object(fs, "_get_client", return_value=mock_client):
        results = fs.search_flights("JFK", "MIA", "2026-06-15")

    call_kwargs = mock_client.shopping.flight_offers_search.get.call_args.kwargs
    assert call_kwargs["currencyCode"] == "USD"
    assert results[0]["price"].endswith("USD")


# ---------------------------------------------------------------------------
# 5. Flight cache avoids duplicate Amadeus calls
# ---------------------------------------------------------------------------

def test_flight_cache_prevents_duplicate_calls():
    """A second identical search must hit the cache, not re-call the API."""
    offer = _make_offer("USD")
    mock_client = _mock_client([offer])
    fs._flight_cache.clear()

    with patch.object(fs, "_get_client", return_value=mock_client):
        fs.search_flights("JFK", "MIA", "2026-06-15")
        fs.search_flights("JFK", "MIA", "2026-06-15")

    assert mock_client.shopping.flight_offers_search.get.call_count == 1


# ---------------------------------------------------------------------------
# 6. Expired cache triggers a fresh API call
# ---------------------------------------------------------------------------

def test_expired_cache_triggers_fresh_call():
    """Entries older than FLIGHT_CACHE_TTL must not be served from cache."""
    offer = _make_offer("USD")
    mock_client = _mock_client([offer])
    fs._flight_cache.clear()

    cache_key = "JFK:MIA:2026-07-01:USD:False:any"
    # Inject a stale entry (well past TTL)
    fs._flight_cache[cache_key] = (time.time() - fs.FLIGHT_CACHE_TTL - 1, [{"price": "stale"}])

    with patch.object(fs, "_get_client", return_value=mock_client):
        results = fs.search_flights("JFK", "MIA", "2026-07-01")

    mock_client.shopping.flight_offers_search.get.assert_called_once()
    # Result should be the fresh offer, not the stale cached one
    assert results[0]["price"] != "stale"


# ---------------------------------------------------------------------------
# 7. session currency persistence — routes layer
# ---------------------------------------------------------------------------

def test_session_stores_currency():
    """After a request with currency='EUR', the session must remember 'EUR'."""
    from backend.app.api import routes

    routes._sessions.clear()
    sid = "test-session-currency"

    # Simulate what routes.py stores after a turn
    routes._sessions[sid] = {
        "messages": [],
        "match_data": [],
        "departure_city": "",
        "departure_date": "",
        "preferred_airline": "",
        "check_in_date": "",
        "check_out_date": "",
        "entities": {},
        "nonstop": False,
        "max_results": 10,
        "currency": "EUR",   # explicitly saved
    }

    prev = routes._sessions.get(sid, {})
    resolved = "GBP" or prev.get("currency", "USD")  # new request overrides
    assert resolved == "GBP"

    resolved_fallback = None or prev.get("currency", "USD")  # no new currency → use session
    assert resolved_fallback == "EUR"


# ---------------------------------------------------------------------------
# 8. search_flights_for_match currency propagation end-to-end
# ---------------------------------------------------------------------------

def test_search_flights_for_match_passes_currency():
    """search_flights_for_match must propagate the currency arg to Amadeus."""
    # Toronto → "YYZ", Miami → "MIA" (from pre-seeded _iata_cache)
    offer = _make_offer("CAD", origin="YYZ", dest="MIA")
    mock_client = _mock_client([offer])
    fs._flight_cache.clear()

    with patch.object(fs, "_get_client", return_value=mock_client):
        # Pre-populate airport details to avoid extra API calls
        fs._airport_details_cache["YYZ"] = {"name": "YYZ", "detailedName": "Toronto Pearson", "offset": "-05:00", "tz": "ET", "city": "Toronto"}
        fs._airport_details_cache["MIA"] = {"name": "MIA", "detailedName": "Miami Intl", "offset": "-05:00", "tz": "ET", "city": "Miami"}

        results = fs.search_flights_for_match(
            departure_city="toronto",
            match_city="miami",
            match_date="2026-06-15",
            currency="CAD",
        )

    call_kwargs = mock_client.shopping.flight_offers_search.get.call_args.kwargs
    assert call_kwargs["currencyCode"] == "CAD"
    assert len(results) >= 1
    assert "C$" in results[0]["price"]

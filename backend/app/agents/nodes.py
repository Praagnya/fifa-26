import json
import logging
import os
from openai import OpenAI

logger = logging.getLogger(__name__)

from backend.app.agents.state import AgentState
from backend.app.agents.prompts.system import (
    ORCHESTRATOR_PROMPT,
    SCOUT_PROMPT,
    CONCIERGE_PROMPT,
    LIAISON_PROMPT,
)
from backend.app.agents.tools.match_search import search_matches
from backend.app.agents.tools.flight_search import search_flights_for_match
from backend.app.agents.tools.hotel_search import search_hotels_for_match

_openai_client: OpenAI | None = None


def _get_openai() -> OpenAI:
    global _openai_client
    if _openai_client is None:
        _openai_client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
    return _openai_client


def _call_llm(system: str, user_msg: str) -> str:
    """Call OpenAI API and return the text response."""
    client = _get_openai()
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user_msg},
        ],
        temperature=0.3,
    )
    return response.choices[0].message.content.strip()


def orchestrator(state: AgentState) -> dict:
    """
    Classify intent, extract entities, and fetch match data from DB.
    """
    query = state["query"]

    # Ask Gemini to classify intent and extract entities
    # Pass recent history to help context (e.g. "cheapest" after hotel prompt)
    messages = state.get("messages", [])
    history_context = ""
    if messages:
        # Get last 2 messages for context
        last_msgs = messages[-2:]
        history_context = "\nCONVERSATION HISTORY:\n" + "\n".join([f"{m['role'].upper()}: {m['content']}" for m in last_msgs])

    orchestrator_input = f"{ORCHESTRATOR_PROMPT}\n\n{history_context}\n\nUSER QUERY: {query}"
    raw = _call_llm(orchestrator_input, "")

    # Parse JSON from Gemini response
    try:
        # Strip markdown fences if present
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1]
            cleaned = cleaned.rsplit("```", 1)[0]
        parsed = json.loads(cleaned)
    except (json.JSONDecodeError, IndexError):
        parsed = {"intent": "general", "entities": {}}

    intent = parsed.get("intent", "general")
    entities = parsed.get("entities", {})

    # Clean up null strings from Gemini
    for key in entities:
        if entities[key] in ("null", "None", ""):
            entities[key] = None

    # Fetch match data from DB if we have entity info, otherwise preserve previous
    match_data = []
    if entities.get("team") or entities.get("city") or entities.get("stage"):
        match_data = search_matches(query, entities)
    if not match_data:
        match_data = state.get("match_data", [])

    departure_city = entities.get("departure_city") or state.get("departure_city", "")
    # Current message airline (from entities) wins over session; _resolve_airline_code handles name→IATA
    preferred_airline = entities.get("airline") or state.get("preferred_airline", "")
    # Current message currency wins over session/request default
    currency = entities.get("currency") or state.get("currency", "USD")
    # Nonstop preference: true if user asks for it, otherwise preserve session state
    nonstop = bool(entities.get("nonstop")) or state.get("nonstop", False)
    # Max results: use entity if provided, otherwise preserve session state
    max_results = entities.get("max_results") or state.get("max_results", 10)
    if isinstance(max_results, str) and max_results.isdigit():
        max_results = int(max_results)
    if not isinstance(max_results, int) or max_results < 1:
        max_results = 10

    logger.info(f"ORCHESTRATOR: intent={intent}, departure_city='{departure_city}', entities={entities}")

    return {
        "intent": intent,
        "entities": entities,
        "match_data": match_data,
        "departure_city": departure_city or "",
        "preferred_airline": preferred_airline or "",
        "currency": currency,
        "nonstop": nonstop,
        "max_results": max_results,
        "hotel_preference": entities.get("hotel_preference"),
        "current_agent": "orchestrator",
        "messages": [{"role": "orchestrator", "content": f"Intent: {intent}, Entities: {entities}"}],
    }


def scout(state: AgentState) -> dict:
    """
    Search for flights using Amadeus API, then summarize with Gemini.
    """
    match_data = state.get("match_data", [])
    departure_city = state.get("departure_city", "")
    entities = state.get("entities", {})
    logger.info(f"SCOUT: departure_city='{departure_city}', entities={entities}")

    # Determine match city and date from match_data or entities
    match_city = ""
    match_date = ""

    if match_data:
        first_match = match_data[0]
        match_city = first_match.get("city", "")
        kickoff = first_match.get("kickoff_utc", "")
        if kickoff and not match_date:
            match_date = str(kickoff)[:10]  # Extract YYYY-MM-DD

    if not match_city:
        match_city = entities.get("city") or ""
    
    # Prioritize explicit departure date from UI (state)
    if state.get("departure_date"):
        match_date = state["departure_date"]
    
    if not match_date:
        match_date = entities.get("date") or ""

    logger.info(f"SCOUT: resolved match_city='{match_city}', match_date='{match_date}', departure_city='{departure_city}'")

    # If we're missing critical info, return an error
    if not departure_city:
        logger.warning("SCOUT: EARLY RETURN — missing departure_city")
        return {
            "flight_results": [],
            "error": "I need to know where you're flying from. Could you tell me your departure city?",
            "current_agent": "scout",
            "messages": [{"role": "scout", "content": "Missing departure city"}],
        }

    if not match_city or not match_date:
        logger.warning(f"SCOUT: EARLY RETURN — missing match_city='{match_city}' or match_date='{match_date}'")
        return {
            "flight_results": [],
            "error": "I need a specific match to search flights for. Could you mention which match or city you'd like to fly to?",
            "current_agent": "scout",
            "messages": [{"role": "scout", "content": "Missing match city or date"}],
        }

    # Search flights via Amadeus
    preferred_airline = state.get("preferred_airline", "") or None
    currency = state.get("currency", "USD")
    nonstop = state.get("nonstop", False)
    max_results = state.get("max_results", 10)
    flight_results = search_flights_for_match(
        departure_city=departure_city,
        match_city=match_city,
        match_date=match_date,
        airline=preferred_airline,
        currency=currency,
        nonstop=nonstop,
        max_results=max_results,
    )

    # Use Gemini to summarize
    scout_prompt = SCOUT_PROMPT.format(
        flight_results=json.dumps(flight_results, indent=2, default=str),
        match_data=json.dumps(match_data[:3], indent=2, default=str),
        user_timezone=state.get("user_timezone", "UTC"),
    )
    summary = _call_llm(scout_prompt, state["query"])

    return {
        "flight_results": flight_results,
        "result": summary,
        "current_agent": "scout",
        "messages": [{"role": "scout", "content": summary}],
    }


def concierge(state: AgentState) -> dict:
    """
    Search for hotels using Amadeus API, then summarize with LLM.
    """
    match_data = state.get("match_data", [])
    print(f"DEBUG CONCIERGE: match_data={match_data}")
    # DEBUG: Ensure match_data is loaded
    entities = state.get("entities", {})

    # Determine match city and date
    match_city = ""
    match_date = ""

    if match_data:
        first_match = match_data[0]
        match_city = first_match.get("city", "")
        kickoff = first_match.get("kickoff_utc", "")
        if kickoff:
            match_date = str(kickoff)[:10]

    if not match_city:
        match_city = entities.get("city") or ""

    if not match_date:
        match_date = entities.get("date") or ""

    if not match_city:
        return {
            "hotel_results": [],
            "error": "I need to know which city you'd like to find hotels in. Could you mention a match or city?",
            "current_agent": "concierge",
            "messages": [{"role": "concierge", "content": "Missing city"}],
        }

    # Smart defaults: check_in = day before match, check_out = day after
    check_in = entities.get("check_in_date") or state.get("check_in_date", "")
    check_out = entities.get("check_out_date") or state.get("check_out_date", "")

    if match_date and (not check_in or not check_out):
        from datetime import datetime, timedelta
        try:
            match_dt = datetime.strptime(match_date, "%Y-%m-%d")
            if not check_in:
                check_in = (match_dt - timedelta(days=1)).strftime("%Y-%m-%d")
            if not check_out:
                check_out = (match_dt + timedelta(days=1)).strftime("%Y-%m-%d")
        except ValueError:
            pass

    if not check_in or not check_out:
        return {
            "hotel_results": [],
            "error": "I need dates to search for hotels. Could you mention when you'd like to check in and check out, or which match you're attending?",
            "current_agent": "concierge",
            "messages": [{"role": "concierge", "content": "Missing dates"}],
        }

    adults = entities.get("guests") or 1
    if isinstance(adults, str) and adults.isdigit():
        adults = int(adults)
    if not isinstance(adults, int) or adults < 1:
        adults = 1

    currency = state.get("currency", "USD")
    hotel_preference = entities.get("hotel_preference")

    # Parse max_distance_miles from entities
    max_distance_miles = entities.get("max_distance_miles")
    if max_distance_miles is not None:
        try:
            max_distance_miles = float(max_distance_miles)
        except (ValueError, TypeError):
            max_distance_miles = None

    # If no preference, skip search and ask user via UI Form
    hotel_results = []
    if hotel_preference:
        hotel_results = search_hotels_for_match(
            match_city=match_city,
            check_in=check_in,
            check_out=check_out,
            adults=adults,
            currency=currency,
            preference=hotel_preference,
            max_distance_miles=max_distance_miles,
        )

        # Use LLM to summarize results
        concierge_prompt = CONCIERGE_PROMPT.format(
            hotel_results=json.dumps(hotel_results, indent=2, default=str),
            match_data=json.dumps(match_data[:3], indent=2, default=str),
            hotel_preference=hotel_preference or "None",
        )
        summary = _call_llm(concierge_prompt, state["query"])
        
        return {
            "hotel_results": hotel_results,
            "check_in_date": check_in,
            "check_out_date": check_out,
            "result": summary,
            "current_agent": "concierge",
            "messages": [{"role": "concierge", "content": summary}],
            "show_hotel_search_form": False,
        }
    else:
        # No preference -> Trigger UI Form
        msg_content = f"I found the match in {match_city}. Please select your hotel preferences below to see the best options."
        return {
            "hotel_results": [],
            "check_in_date": check_in,
            "check_out_date": check_out,
            "result": msg_content,
            "current_agent": "concierge",
            "messages": [{"role": "concierge", "content": msg_content}],
            "show_hotel_search_form": True,
        }


def liaison(state: AgentState) -> dict:
    """
    Format the final user-facing response using Gemini.
    """
    intent = state.get("intent", "general")
    match_data = state.get("match_data", [])
    error = state.get("error", "")

    # If scout already produced a result, use it directly
    scout_response = ""
    if intent == "flight_search" and state.get("result"):
        scout_response = state["result"]

    concierge_response = ""
    if intent == "hotel_search" and state.get("result"):
        concierge_response = state["result"]

    liaison_prompt = LIAISON_PROMPT.format(
        intent=intent,
        match_data=json.dumps(match_data[:5], indent=2, default=str) if match_data else "None",
        scout_response=scout_response or "None",
        concierge_response=concierge_response or "None",
        error=error or "None",
    )

    response = _call_llm(liaison_prompt, state["query"])

    return {
        "result": response,
        "current_agent": "liaison",
        "messages": [{"role": "liaison", "content": response}],
    }

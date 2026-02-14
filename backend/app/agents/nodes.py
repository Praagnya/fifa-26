import json
import os
from openai import OpenAI

from backend.app.agents.state import AgentState
from backend.app.agents.prompts.system import (
    ORCHESTRATOR_PROMPT,
    SCOUT_PROMPT,
    LIAISON_PROMPT,
)
from backend.app.agents.tools.match_search import search_matches
from backend.app.agents.tools.flight_search import search_flights_for_match

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
    raw = _call_llm(ORCHESTRATOR_PROMPT, query)

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

    # Fetch match data from DB if we have entity info
    match_data = []
    if entities.get("team") or entities.get("city") or entities.get("stage"):
        match_data = search_matches(query, entities)

    departure_city = entities.get("departure_city") or state.get("departure_city", "")

    return {
        "intent": intent,
        "entities": entities,
        "match_data": match_data,
        "departure_city": departure_city or "",
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

    # Determine match city and date from match_data or entities
    match_city = ""
    match_date = ""

    if match_data:
        first_match = match_data[0]
        match_city = first_match.get("city", "")
        kickoff = first_match.get("kickoff_utc", "")
        if kickoff:
            match_date = str(kickoff)[:10]  # Extract YYYY-MM-DD

    if not match_city:
        match_city = entities.get("city") or ""
    if not match_date:
        match_date = entities.get("date") or ""

    # If we're missing critical info, return an error
    if not departure_city:
        return {
            "flight_results": [],
            "error": "I need to know where you're flying from. Could you tell me your departure city?",
            "current_agent": "scout",
            "messages": [{"role": "scout", "content": "Missing departure city"}],
        }

    if not match_city or not match_date:
        return {
            "flight_results": [],
            "error": "I need a specific match to search flights for. Could you mention which match or city you'd like to fly to?",
            "current_agent": "scout",
            "messages": [{"role": "scout", "content": "Missing match city or date"}],
        }

    # Search flights via Amadeus
    flight_results = search_flights_for_match(
        departure_city=departure_city,
        match_city=match_city,
        match_date=match_date,
    )

    # Use Gemini to summarize
    scout_prompt = SCOUT_PROMPT.format(
        flight_results=json.dumps(flight_results, indent=2, default=str),
        match_data=json.dumps(match_data[:3], indent=2, default=str),
    )
    summary = _call_llm(scout_prompt, state["query"])

    return {
        "flight_results": flight_results,
        "result": summary,
        "current_agent": "scout",
        "messages": [{"role": "scout", "content": summary}],
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

    liaison_prompt = LIAISON_PROMPT.format(
        intent=intent,
        match_data=json.dumps(match_data[:5], indent=2, default=str) if match_data else "None",
        scout_response=scout_response or "None",
        error=error or "None",
    )

    response = _call_llm(liaison_prompt, state["query"])

    return {
        "result": response,
        "current_agent": "liaison",
        "messages": [{"role": "liaison", "content": response}],
    }

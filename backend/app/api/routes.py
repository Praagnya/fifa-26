import logging
import traceback
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from backend.app.db.repository import get_all_matches, get_match_by_id, get_h2h_matches, get_recent_matches
from backend.app.agents.graph import graph
from backend.app.api.auth import get_current_user, check_rate_limit, record_query, AuthUser


import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("backend_debug.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

router = APIRouter()

# In-memory session store: session_id -> last graph state
_sessions: dict[str, dict] = defaultdict(dict)


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    airline: Optional[str] = None
    date: Optional[str] = None
    timezone: Optional[str] = None
    currency: Optional[str] = None


@router.get("/matches")
async def list_matches():
    return get_all_matches()


@router.get("/matches/{match_id}")
async def get_match(match_id: int):
    return get_match_by_id(match_id)


@router.get("/h2h/{team1}/{team2}")
async def get_head_to_head(team1: str, team2: str):
    matches = get_h2h_matches(team1, team2)
    
    # Get recent form for both teams
    team1_recent = get_recent_matches(team1, limit=5)
    team2_recent = get_recent_matches(team2, limit=5)

    # Calculate summary stats
    team1_wins = 0
    team2_wins = 0
    draws = 0

    for m in matches:
        # Check explicit result string first if available
        res = (m.get("result") or "").lower()
        
        # Determine winner based on score if result text is ambiguous or missing
        h_score = m["home_score"]
        a_score = m["away_score"]
        
        # Penalties logic
        h_pen = m.get("home_penalties")
        a_pen = m.get("away_penalties")
        
        if h_pen is not None and a_pen is not None and h_pen != a_pen:
             if h_pen > a_pen:
                 if m["home_team"] == team1: team1_wins += 1
                 else: team2_wins += 1
             else:
                 if m["away_team"] == team1: team1_wins += 1
                 else: team2_wins += 1
        elif h_score > a_score:
            if m["home_team"] == team1: team1_wins += 1
            else: team2_wins += 1
        elif a_score > h_score:
            if m["away_team"] == team1: team1_wins += 1
            else: team2_wins += 1
        else:
            draws += 1

    return {
        "summary": {
            "total_matches": len(matches),
            "team1_wins": team1_wins,
            "team2_wins": team2_wins,
            "draws": draws,
        },
        "history": matches,
        "team1_recent": team1_recent,
        "team2_recent": team2_recent
    }


@router.get("/chat/limit")
async def chat_limit(user: AuthUser = Depends(get_current_user)):
    """Return the user's current rate limit status."""
    status = check_rate_limit(user)
    return {"remaining": status["remaining"], "limit": 15, "reset_in": status["reset_in"]}


@router.post("/chat")
async def chat(request: ChatRequest, user: AuthUser = Depends(get_current_user)):
    # Enforce rate limit
    limit_status = check_rate_limit(user)
    if not limit_status["allowed"]:
        reset_in = limit_status["reset_in"]
        hours = reset_in // 3600
        mins = (reset_in % 3600) // 60
        time_str = f"{hours}h {mins}m" if hours > 0 else f"{mins}m"
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. You've used all 15 queries for this 12-hour window. Try again in {time_str}.",
        )

    # Record this query
    remaining = record_query(user)

    try:
        sid = request.session_id or "default"
        prev = _sessions.get(sid, {})

        # Build conversation history string from previous turns
        history_lines = []
        for msg in prev.get("messages", [])[-10:]:  # last 10 messages
            role = msg.get("role", "unknown")
            content = msg.get("content", "")
            if role in ("user", "liaison"):
                label = "User" if role == "user" else "Assistant"
                history_lines.append(f"{label}: {content}")
        history_str = "\n".join(history_lines)

        # Prepend history to the query so the orchestrator has context
        query_with_context = request.message
        if history_str:
            query_with_context = f"[Conversation so far]\n{history_str}\n\n[New message]\n{request.message}"

        result = graph.invoke({
            "query": query_with_context,
            "messages": [{"role": "user", "content": request.message}],
            "current_agent": "",
            "intent": "",
            "entities": {},
            "match_data": prev.get("match_data", []),
            "departure_city": prev.get("departure_city", ""),
            "departure_date": request.date or prev.get("departure_date", ""),
            "preferred_airline": request.airline or prev.get("preferred_airline", ""),
            "flight_results": [],
            "hotel_results": [],
            "check_in_date": prev.get("check_in_date", ""),
            "check_out_date": prev.get("check_out_date", ""),
            "show_hotel_search_form": False,
            "result": "",
            "session_id": sid,
            "error": "",
            "user_timezone": request.timezone or "UTC",
            "currency": request.currency or "USD",
            "nonstop": prev.get("nonstop", False),
            "max_results": prev.get("max_results", 10),
        })

        # Save session state for next turn
        _sessions[sid] = {
            "messages": (prev.get("messages", [])
                         + [{"role": "user", "content": request.message}]
                         + [{"role": "liaison", "content": result.get("result", "")}]),
            "match_data": result.get("match_data") or prev.get("match_data", []),
            "departure_city": result.get("departure_city") or prev.get("departure_city", ""),
            "departure_date": result.get("departure_date") or prev.get("departure_date", ""),
            "preferred_airline": result.get("preferred_airline") or prev.get("preferred_airline", ""),
            "check_in_date": result.get("check_in_date") or prev.get("check_in_date", ""),
            "check_out_date": result.get("check_out_date") or prev.get("check_out_date", ""),
            "entities": result.get("entities") or prev.get("entities", {}),
            "nonstop": result.get("nonstop", prev.get("nonstop", False)),
            "max_results": result.get("max_results", prev.get("max_results", 10)),
        }

        # Build response with structured flight data when available
        response: dict = {"reply": result.get("result", "Sorry, I couldn't process that.")}

        flight_results = result.get("flight_results", [])
        if flight_results and not any("error" in f for f in flight_results):
            response["flights"] = flight_results

        hotel_results = result.get("hotel_results", [])
        if hotel_results:
            # Check for errors safely (handle dict or list)
            has_error = False
            if isinstance(hotel_results, list):
                if any("error" in h for h in hotel_results):
                    has_error = True
            elif isinstance(hotel_results, dict):
                 if "error" in hotel_results:
                     has_error = True
            
            if not has_error:
                response["hotels"] = hotel_results

        match_data = result.get("match_data", [])
        if match_data:
            response["match"] = match_data[0]  # The primary match

        if result.get("show_hotel_search_form"):
            response["show_hotel_form"] = True
            response["check_in"] = result.get("check_in_date")
            response["check_out"] = result.get("check_out_date")

        # Pass sort and currency preferences from orchestrator entities
        entities = result.get("entities", {})
        sort_pref = entities.get("sort")
        if sort_pref and sort_pref in ("price", "price_desc", "duration", "stops", "departure"):
            response["sort"] = sort_pref
        currency_pref = entities.get("currency")
        if currency_pref and currency_pref in ("USD", "EUR", "GBP", "CAD", "AUD", "JPY", "INR"):
            response["currency"] = currency_pref

        # Build refinement object for flight_refine intent (no API call needed)
        intent = result.get("intent", "")
        if intent == "flight_refine":
            refinement: dict = {}
            if sort_pref:
                refinement["sort"] = sort_pref
            airline_pref = entities.get("airline")
            if airline_pref:
                refinement["filter_airline"] = airline_pref
            if entities.get("nonstop"):
                refinement["filter_stops"] = "0"
            max_results = entities.get("max_results")
            if max_results:
                refinement["max_results"] = int(max_results)
            response["refinement"] = refinement

        response["queries_remaining"] = remaining
        return response
    except Exception as e:
        logger.error(f"Chat error: {traceback.format_exc()}")
        return {"reply": f"Something went wrong: {e}"}


@router.post("/visa")
async def visa():
    return {"message": "visa endpoint"}

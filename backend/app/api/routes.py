import logging
import traceback
from collections import defaultdict

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from backend.app.db.repository import get_all_matches, get_match_by_id, get_h2h_matches, get_recent_matches
from backend.app.agents.graph import graph

logger = logging.getLogger(__name__)

router = APIRouter()

# In-memory session store: session_id -> last graph state
_sessions: dict[str, dict] = defaultdict(dict)


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    airline: Optional[str] = None
    date: Optional[str] = None


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


@router.post("/chat")
async def chat(request: ChatRequest):
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
            "departure_date": request.date or "",
            "preferred_airline": request.airline or "",
            "flight_results": [],
            "result": "",
            "session_id": sid,
            "error": "",
        })

        # Save session state for next turn
        _sessions[sid] = {
            "messages": (prev.get("messages", [])
                         + [{"role": "user", "content": request.message}]
                         + [{"role": "liaison", "content": result.get("result", "")}]),
            "match_data": result.get("match_data") or prev.get("match_data", []),
            "departure_city": result.get("departure_city") or prev.get("departure_city", ""),
            "entities": result.get("entities") or prev.get("entities", {}),
        }

        # Build response with structured flight data when available
        response: dict = {"reply": result.get("result", "Sorry, I couldn't process that.")}

        flight_results = result.get("flight_results", [])
        if flight_results and not any("error" in f for f in flight_results):
            response["flights"] = flight_results

        match_data = result.get("match_data", [])
        if match_data:
            response["match"] = match_data[0]  # The primary match

        return response
    except Exception as e:
        logger.error(f"Chat error: {traceback.format_exc()}")
        return {"reply": f"Something went wrong: {e}"}


@router.post("/visa")
async def visa():
    return {"message": "visa endpoint"}

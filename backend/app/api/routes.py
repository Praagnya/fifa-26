from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from backend.app.db.repository import get_all_matches, get_match_by_id, get_h2h_matches, get_recent_matches

router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


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
    # Simple response for now - can be enhanced with multi-agent system
    responses = [
        "I'm here to help with FIFA 2026 information!",
        "Great question about the World Cup!",
        "Let me help you with that FIFA 2026 query.",
        "I can assist with matches, teams, and stadium information.",
    ]

    import random

    response = random.choice(responses)

    # Add context based on common questions
    message_lower = request.message.lower()
    if "match" in message_lower or "game" in message_lower:
        response = "You can check the schedule on the main page. I'll soon be able to provide specific match details!"
    elif "team" in message_lower:
        response = "Select your favorite teams to track their matches. I'll soon have detailed team information!"
    elif "stadium" in message_lower or "venue" in message_lower:
        response = "The 2026 World Cup will be hosted across multiple cities in North America. Detailed venue info coming soon!"
    elif "visa" in message_lower or "travel" in message_lower:
        response = "I can help with visa information for World Cup travel. This feature will be available soon!"

    return {"reply": response}


@router.post("/visa")
async def visa():
    return {"message": "visa endpoint"}

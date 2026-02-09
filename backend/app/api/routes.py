from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from backend.app.db.repository import get_all_matches, get_match_by_id

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

    # Add some context based on common questions
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

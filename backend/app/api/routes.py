from fastapi import APIRouter

from backend.app.db.repository import get_all_matches, get_match_by_id

router = APIRouter()


@router.get("/matches")
async def list_matches():
    return get_all_matches()


@router.get("/matches/{match_id}")
async def get_match(match_id: int):
    return get_match_by_id(match_id)


@router.post("/chat")
async def chat():
    return {"message": "chat endpoint"}


@router.post("/visa")
async def visa():
    return {"message": "visa endpoint"}

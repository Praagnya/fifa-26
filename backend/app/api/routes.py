from fastapi import APIRouter

router = APIRouter()


@router.post("/chat")
async def chat():
    return {"message": "chat endpoint"}


@router.post("/visa")
async def visa():
    return {"message": "visa endpoint"}

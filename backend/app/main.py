from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI

from backend.app.api.routes import router

app = FastAPI(title="FIFA 26 API", version="0.1.0")

app.include_router(router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok"}

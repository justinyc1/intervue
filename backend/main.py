import logging
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from db import db
from redis_client import close_redis, init_redis
from routes.behavioral import router as behavioral_router
from routes.code import router as code_router
from routes.companies import router as companies_router
from routes.feedback import router as feedback_router
from routes.health import router as health_router
from routes.interviews import router as interviews_router
from routes.problems import router as problems_router
from routes.transcript import router as transcript_router
from routes.tts import router as tts_router
from routes.upload import router as upload_router
from routes.ws import router as ws_router
from services.problems_seed import seed_problems

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_redis(settings.redis_url)
    try:
        seed_problems()
    except Exception:
        logger.exception("seed_problems failed; starting with partial catalog")
    try:
        db.solved_problems.create_index(
            [("clerk_user_id", 1), ("problem_slug", 1)],
            unique=True,
            name="solved_problems_user_slug_unique",
        )
    except Exception:
        logger.exception("create_index for solved_problems failed")
    yield
    await close_redis()


app = FastAPI(title="Intervue Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://intervue.org",
        "https://www.intervue.org",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(behavioral_router)
app.include_router(interviews_router)
app.include_router(transcript_router)
app.include_router(ws_router)
app.include_router(code_router)
app.include_router(feedback_router)
app.include_router(companies_router)
app.include_router(upload_router)
app.include_router(tts_router)
app.include_router(problems_router)


@app.get("/")
def root():
    return {
        "message": "Backend running",
        "has_elevenlabs_key": bool(settings.elevenlabs_api_key),
        "has_tavily_key": bool(settings.tavily_api_key),
        "has_mongodb_uri": bool(settings.mongodb_uri),
    }


@app.get("/db-test")
def db_test():
    try:
        collections = db.list_collection_names()
        return {"connected": True, "collections": collections}
    except Exception as e:
        return {"connected": False, "error": str(e)}


@app.get("/tavily-test")
async def tavily_test():
    url = "https://api.tavily.com/search"
    payload = {
        "api_key": settings.tavily_api_key,
        "query": "software engineer interview at Google",
        "search_depth": "basic",
        "max_results": 3,
    }
    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=payload)
        return response.json()


@app.get("/eleven-test")
async def eleven_test():
    url = "https://api.elevenlabs.io/v1/models"
    headers = {"xi-api-key": settings.elevenlabs_api_key}
    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers)
        return response.json()

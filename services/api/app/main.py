"""PadForward API — FastAPI application entrypoint."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.config import get_settings
from app.db import Base, SessionLocal, engine
from app.seed import seed_if_empty

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("padforward")

_initialised = False


def init_db() -> None:
    """Create tables and seed demo data. Idempotent — safe to call on every
    serverless cold start (Vercel) as well as from the uvicorn lifespan."""
    global _initialised
    if _initialised:
        return
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        if seed_if_empty(db):
            logger.info("Seeded demo community network data")
    _initialised = True


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    settings = get_settings()
    logger.info(
        "Feature detection — gemini: %s, google_maps: %s, snowflake: %s",
        settings.gemini_enabled, settings.google_maps_enabled, settings.snowflake_enabled,
    )
    yield


app = FastAPI(
    title="PadForward API",
    description="Community-powered emergency menstrual product access network.",
    version="0.1.0",
    lifespan=lifespan,
)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

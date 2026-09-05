"""Vercel serverless entrypoint.

Vercel's Python runtime serves the ASGI `app` object but does not run the
uvicorn lifespan, so we initialise the database (create tables + idempotent
demo seed) at import time — i.e. once per cold start.
"""
from app.main import app, init_db

init_db()

__all__ = ["app"]

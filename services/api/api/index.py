"""Vercel serverless entrypoint.

Vercel's Python runtime serves the ASGI `app` object but does not run the
uvicorn lifespan, so we initialise the database (create tables + idempotent
demo seed) at import time — i.e. once per cold start.

When deployed as a service in a multi-service Vercel project, requests
arrive prefixed (e.g. /api/api/health); we strip that prefix so FastAPI
routes match.
"""
import os

from app.main import app as fastapi_app, init_db

init_db()

_PREFIX = os.environ.get("API_PATH_PREFIX", "/api/api")


class _StripPrefix:
    def __init__(self, asgi_app, prefix: str):
        self.asgi_app = asgi_app
        self.prefix = prefix.rstrip("/")

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http" and self.prefix:
            path = scope.get("path", "")
            if path == self.prefix or path.startswith(self.prefix + "/"):
                scope = dict(scope)
                scope["path"] = path[len(self.prefix):] or "/"
        await self.asgi_app(scope, receive, send)


app = _StripPrefix(fastapi_app, _PREFIX)

__all__ = ["app"]

"""Shared test fixtures — in-memory SQLite with seeded demo data."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ["DATABASE_URL"] = "sqlite://"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base, get_db
from app.main import app
from app.seed import seed_if_empty


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(bind=engine)
    TestSession = sessionmaker(bind=engine, expire_on_commit=False)
    with TestSession() as session:
        seed_if_empty(session)
        yield session


@pytest.fixture()
def client(db_session):
    app.dependency_overrides[get_db] = lambda: (yield db_session)
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

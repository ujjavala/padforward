"""Pad Champion adoption — deliberately simple role model for the MVP."""
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Champion, Station, User, UserRole


def adopt_station(db: Session, station: Station, user_id: int | None = None) -> Champion:
    if user_id is None:
        user = User(role=UserRole.CHAMPION)
        db.add(user)
        db.flush()
        user_id = user.id
    champion = Champion(
        user_id=user_id,
        station_id=station.id,
        status="ACTIVE",
        verified_at=datetime.now(timezone.utc),
    )
    db.add(champion)
    db.commit()
    db.refresh(champion)
    return champion


def champion_count(db: Session, station_id: int) -> int:
    return db.scalar(select(func.count(Champion.id)).where(Champion.station_id == station_id)) or 0

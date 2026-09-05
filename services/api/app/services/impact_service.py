"""Community impact aggregates. Backed by PostgreSQL; Snowflake is an optional
analytics layer behind this abstraction (see docs/architecture.md)."""
from datetime import datetime, time, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import (
    Champion,
    Donation,
    Request,
    RequestType,
    Station,
    SupplyReport,
    User,
    UserRole,
)
from app.schemas.schemas import ImpactOut
from app.services.station_service import highest_need


def get_impact(db: Session) -> ImpactOut:
    settings = get_settings()
    today_start = datetime.combine(datetime.now(timezone.utc).date(), time.min, tzinfo=timezone.utc)

    stations = db.scalar(select(func.count(Station.id))) or 0
    donors = db.scalar(select(func.count(User.id)).where(User.role == UserRole.DONOR)) or 0
    champions = db.scalar(select(func.count(Champion.id))) or 0
    pads_donated = db.scalar(select(func.coalesce(func.sum(Donation.quantity), 0))) or 0
    donations = db.scalar(select(func.count(Donation.id))) or 0
    restocks = db.scalar(select(func.count(Station.id)).where(Station.last_restocked_at.isnot(None))) or 0
    fulfilled = (
        db.scalar(
            select(func.count(Request.id)).where(
                Request.request_type == RequestType.PAD_CLAIMED, Request.resolved_at.isnot(None)
            )
        )
        or 0
    )
    today_pads = (
        db.scalar(
            select(func.coalesce(func.sum(Donation.quantity), 0)).where(
                Donation.created_at >= today_start
            )
        )
        or 0
    )
    today_reports = (
        db.scalar(select(func.count(SupplyReport.id)).where(SupplyReport.created_at >= today_start))
        or 0
    )
    today_restocks = (
        db.scalar(select(func.count(Donation.id)).where(Donation.created_at >= today_start)) or 0
    )

    urgent = [s for s in highest_need(db, limit=3) if s.need_score > 60]

    return ImpactOut(
        stations=stations,
        donors=donors,
        champions=champions,
        pads_donated=pads_donated,
        donations=donations,
        restocks=restocks,
        requests_fulfilled=fulfilled,
        today_pads_donated=today_pads,
        today_supply_reports=today_reports,
        today_restocks=today_restocks,
        urgent_stations=urgent,
        demo_network=settings.demo_mode,
    )

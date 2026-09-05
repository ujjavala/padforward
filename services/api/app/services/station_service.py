"""Station domain logic: discovery, status, need scoring, trust model."""
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.maps.geo import haversine_km, point_to_segment_km, walking_minutes
from app.models import (
    Champion,
    Confidence,
    ReporterType,
    Request,
    RequestType,
    Station,
    SupplyReport,
    SupplyStatus,
)
from app.schemas.schemas import StationOut
from app.scoring.need_score import NeedInputs, classify_need, compute_need_score


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def derive_supply_status(current_supply: int, has_reports: bool) -> SupplyStatus:
    if not has_reports:
        return SupplyStatus.UNKNOWN
    if current_supply <= 0:
        return SupplyStatus.NONE
    if current_supply < 10:
        return SupplyStatus.A_FEW
    return SupplyStatus.PLENTY


def recent_requests_24h(db: Session, station_id: int) -> int:
    cutoff = _utcnow() - timedelta(hours=24)
    return (
        db.scalar(
            select(func.count(Request.id)).where(
                Request.station_id == station_id, Request.created_at >= cutoff
            )
        )
        or 0
    )


def recompute_need_score(db: Session, station: Station) -> Station:
    score = compute_need_score(
        NeedInputs(
            current_supply=station.current_supply,
            estimated_demand=station.estimated_demand,
            last_verified_at=station.last_verified_at,
            recent_requests_24h=recent_requests_24h(db, station.id),
            historical_daily_demand=float(station.estimated_demand),
        )
    )
    station.need_score = score
    db.add(station)
    return station


def community_confidence(db: Session, station: Station) -> str:
    """Trust model: champion reports and agreeing recent reports raise confidence;
    contradictory recent reports lower it."""
    cutoff = _utcnow() - timedelta(hours=24)
    reports = (
        db.scalars(
            select(SupplyReport)
            .where(SupplyReport.station_id == station.id, SupplyReport.created_at >= cutoff)
            .order_by(SupplyReport.created_at.desc())
            .limit(10)
        ).all()
    )
    if not reports:
        return "LOW"
    if any(r.report_type == ReporterType.CHAMPION for r in reports):
        base = "HIGH"
    elif len(reports) >= 3:
        base = "HIGH"
    elif len(reports) == 2:
        base = "MEDIUM"
    else:
        base = "LOW"
    # Contradiction check: reports disagreeing wildly lowers confidence.
    values = [r.reported_supply for r in reports[:5] if r.reported_supply is not None]
    if len(values) >= 2 and (max(values) - min(values)) > max(10, max(values) * 0.8):
        return "MEDIUM" if base == "HIGH" else "LOW"
    return base


def to_station_out(
    db: Session,
    station: Station,
    origin: tuple[float, float] | None = None,
) -> StationOut:
    champion_count = (
        db.scalar(select(func.count(Champion.id)).where(Champion.station_id == station.id)) or 0
    )
    out = StationOut.model_validate(station)
    out.need_level = classify_need(station.need_score)
    out.community_confidence = community_confidence(db, station)
    out.champion_count = champion_count
    if origin:
        dist = haversine_km(origin[0], origin[1], station.latitude, station.longitude)
        out.distance_km = round(dist, 2)
        out.walking_minutes = walking_minutes(dist)
    return out


def get_station(db: Session, station_id: int) -> Station | None:
    return db.get(Station, station_id)


def find_nearby(
    db: Session, latitude: float, longitude: float, radius_km: float = 5.0, limit: int = 10
) -> list[StationOut]:
    stations = db.scalars(select(Station)).all()
    results = []
    for s in stations:
        dist = haversine_km(latitude, longitude, s.latitude, s.longitude)
        if dist <= radius_km:
            results.append((dist, s))
    results.sort(key=lambda pair: pair[0])
    return [to_station_out(db, s, (latitude, longitude)) for _, s in results[:limit]]


def highest_need(
    db: Session,
    latitude: float | None = None,
    longitude: float | None = None,
    limit: int = 5,
    radius_km: float | None = None,
) -> list[StationOut]:
    origin = (latitude, longitude) if latitude is not None and longitude is not None else None
    if origin and radius_km is not None:
        stations = db.scalars(select(Station)).all()
        nearby = [
            s
            for s in stations
            if haversine_km(origin[0], origin[1], s.latitude, s.longitude) <= radius_km
        ]
        nearby.sort(key=lambda s: s.need_score, reverse=True)
        return [to_station_out(db, s, origin) for s in nearby[:limit]]
    stations = db.scalars(select(Station).order_by(Station.need_score.desc()).limit(limit)).all()
    return [to_station_out(db, s, origin) for s in stations]


def find_along_route(
    db: Session,
    origin: tuple[float, float],
    dest: tuple[float, float],
    max_detour_km: float = 1.5,
) -> list[StationOut]:
    """Stations within a corridor of the straight-line route, sorted by detour distance."""
    stations = db.scalars(select(Station)).all()
    hits = []
    for s in stations:
        detour = point_to_segment_km(
            s.latitude, s.longitude, origin[0], origin[1], dest[0], dest[1]
        )
        if detour <= max_detour_km:
            hits.append((detour, s))
    hits.sort(key=lambda pair: pair[0])
    results = []
    for detour, s in hits:
        out = to_station_out(db, s, origin)
        out.distance_km = round(detour, 2)
        out.walking_minutes = walking_minutes(detour)
        results.append(out)
    return results


def record_search_request(db: Session, station_id: int) -> None:
    db.add(Request(station_id=station_id, request_type=RequestType.NEED_SEARCH))


def record_claim(db: Session, station: Station, remaining_supply: int | None) -> Station:
    """A person anonymously took a pad. No identity is stored."""
    now = _utcnow()
    req = Request(station_id=station.id, request_type=RequestType.PAD_CLAIMED, resolved_at=now)
    db.add(req)
    if remaining_supply is not None:
        station.current_supply = remaining_supply
        station.last_verified_at = now
    else:
        station.current_supply = max(0, station.current_supply - 1)
    station.supply_status = derive_supply_status(station.current_supply, True)
    recompute_need_score(db, station)
    db.commit()
    db.refresh(station)
    return station

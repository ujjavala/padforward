"""REST API routes."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.ai.agent import get_ai_service
from app.config import get_settings
from app.db import get_db
from app.schemas.schemas import (
    AdoptIn,
    AIQueryIn,
    AIQueryOut,
    ClaimIn,
    DonationIn,
    DonationOut,
    DonationResult,
    ImpactOut,
    SolQuoteOut,
    StationOut,
    SupplyReportIn,
    SupplyReportOut,
)
from app.services import (
    champion_service,
    discovery_service,
    donation_service,
    impact_service,
    report_service,
    solana_service,
    station_service,
)

router = APIRouter()


@router.get("/health")
def health() -> dict:
    settings = get_settings()
    return {
        "status": "ok",
        "demo_mode": settings.demo_mode,
        "features": {
            "gemini": settings.gemini_enabled,
            "google_maps": settings.google_maps_enabled,
            "snowflake": settings.snowflake_enabled,
        },
    }


@router.get("/stations/nearby", response_model=list[StationOut])
def stations_nearby(
    latitude: float = Query(...),
    longitude: float = Query(...),
    radius_km: float = Query(default=5.0, gt=0, le=50),
    db: Session = Depends(get_db),
) -> list[StationOut]:
    stations = station_service.find_nearby(db, latitude, longitude, radius_km)
    if not stations and get_settings().demo_mode:
        # AI-assisted discovery: bootstrap demo community points around the
        # user's real location (Gemini when configured, simulated otherwise).
        discovery_service.discover_stations(db, latitude, longitude)
        stations = station_service.find_nearby(db, latitude, longitude, radius_km)
    return stations


@router.get("/stations/priority", response_model=list[StationOut])
def stations_priority(
    latitude: float | None = Query(default=None),
    longitude: float | None = Query(default=None),
    limit: int = Query(default=5, ge=1, le=20),
    db: Session = Depends(get_db),
) -> list[StationOut]:
    if latitude is not None and longitude is not None:
        # Location-aware: recommend the highest-need stations near the donor,
        # discovering real nearby stations first if none are known here.
        radius = 8.0
        stations = station_service.highest_need(db, latitude, longitude, limit, radius_km=radius)
        if not stations and get_settings().demo_mode:
            discovery_service.discover_stations(db, latitude, longitude)
            stations = station_service.highest_need(
                db, latitude, longitude, limit, radius_km=radius
            )
        if stations:
            return stations
    return station_service.highest_need(db, latitude, longitude, limit)


@router.get("/stations/along-route", response_model=list[StationOut])
def stations_along_route(
    origin_lat: float = Query(...),
    origin_lng: float = Query(...),
    dest_lat: float = Query(...),
    dest_lng: float = Query(...),
    max_detour_km: float = Query(default=1.5, gt=0, le=10),
    db: Session = Depends(get_db),
) -> list[StationOut]:
    return station_service.find_along_route(
        db, (origin_lat, origin_lng), (dest_lat, dest_lng), max_detour_km
    )


@router.get("/stations/{station_id}", response_model=StationOut)
def get_station(station_id: int, db: Session = Depends(get_db)) -> StationOut:
    station = station_service.get_station(db, station_id)
    if station is None:
        raise HTTPException(status_code=404, detail="Station not found")
    return station_service.to_station_out(db, station)


@router.get("/stations/{station_id}/supply", response_model=list[SupplyReportOut])
def get_supply_reports(station_id: int, db: Session = Depends(get_db)) -> list:
    station = station_service.get_station(db, station_id)
    if station is None:
        raise HTTPException(status_code=404, detail="Station not found")
    reports = sorted(station.supply_reports, key=lambda r: r.created_at, reverse=True)[:20]
    return reports


@router.post("/stations/{station_id}/supply-report", response_model=SupplyReportOut, status_code=201)
def create_supply_report(
    station_id: int, body: SupplyReportIn, db: Session = Depends(get_db)
) -> SupplyReportOut:
    station = station_service.get_station(db, station_id)
    if station is None:
        raise HTTPException(status_code=404, detail="Station not found")
    return report_service.create_supply_report(db, station, body.reported_supply, body.report_type)


@router.post("/stations/{station_id}/claim", response_model=StationOut)
def claim_pad(station_id: int, body: ClaimIn, db: Session = Depends(get_db)) -> StationOut:
    """Anonymously mark that a pad was received. No identity is stored."""
    station = station_service.get_station(db, station_id)
    if station is None:
        raise HTTPException(status_code=404, detail="Station not found")
    station = station_service.record_claim(db, station, body.remaining_supply)
    return station_service.to_station_out(db, station)


@router.post("/stations/{station_id}/adopt", response_model=StationOut, status_code=201)
def adopt(station_id: int, body: AdoptIn, db: Session = Depends(get_db)) -> StationOut:
    station = station_service.get_station(db, station_id)
    if station is None:
        raise HTTPException(status_code=404, detail="Station not found")
    champion_service.adopt_station(db, station, body.user_id)
    return station_service.to_station_out(db, station)


@router.post("/stations/{station_id}/verify", response_model=StationOut)
def verify(station_id: int, body: SupplyReportIn, db: Session = Depends(get_db)) -> StationOut:
    """Champion verification — records a HIGH-confidence supply report."""
    station = station_service.get_station(db, station_id)
    if station is None:
        raise HTTPException(status_code=404, detail="Station not found")
    from app.models import ReporterType

    report_service.create_supply_report(db, station, body.reported_supply, ReporterType.CHAMPION)
    return station_service.to_station_out(db, station)


@router.get("/donations/sol-quote", response_model=SolQuoteOut)
def sol_quote(quantity: int = Query(gt=0, le=1000)) -> SolQuoteOut:
    """Quote how much SOL funds a given number of pads (demo pricing)."""
    return solana_service.quote(quantity)


@router.post("/donations", response_model=DonationResult, status_code=201)
def create_donation(body: DonationIn, db: Session = Depends(get_db)) -> DonationResult:
    station = station_service.get_station(db, body.station_id)
    if station is None:
        raise HTTPException(status_code=404, detail="Station not found")
    return donation_service.create_donation(
        db,
        station,
        body.quantity,
        body.donor_id,
        payment_method=body.payment_method,
        wallet_address=body.wallet_address,
    )


@router.get("/donations/{donation_id}", response_model=DonationOut)
def get_donation(donation_id: int, db: Session = Depends(get_db)) -> DonationOut:
    from app.models import Donation

    donation = db.get(Donation, donation_id)
    if donation is None:
        raise HTTPException(status_code=404, detail="Donation not found")
    return donation


@router.get("/impact", response_model=ImpactOut)
def impact(db: Session = Depends(get_db)) -> ImpactOut:
    return impact_service.get_impact(db)


@router.post("/ai/query", response_model=AIQueryOut)
def ai_query(body: AIQueryIn, db: Session = Depends(get_db)) -> AIQueryOut:
    service = get_ai_service()
    return service.process_user_request(db, body.message, body.latitude, body.longitude)

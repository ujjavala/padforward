"""Seed data — clearly-labelled DEMO community points at real Sydney station
coordinates. Supply figures are demo data, not real inventory.
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Champion,
    Confidence,
    Donation,
    DonationStatus,
    ReporterType,
    Request,
    RequestType,
    Station,
    StationType,
    SupplyReport,
    User,
    UserRole,
)
from app.services.station_service import derive_supply_status, recompute_need_score

NOW = datetime.now(timezone.utc)

DEMO_STATIONS = [
    # name, type, lat, lng, address, supply, est_demand, verified_hours_ago, restocked_hours_ago
    ("Central Station", StationType.TRAIN_STATION, -33.8832, 151.2070,
     "Eddy Ave, Haymarket NSW — Demo Community Point", 12, 22, 0.25, 6),
    ("Town Hall Station", StationType.TRAIN_STATION, -33.8734, 151.2070,
     "George St, Sydney NSW — Demo Community Point", 3, 18, 2, 30),
    ("Wynyard Station", StationType.TRAIN_STATION, -33.8656, 151.2058,
     "York St, Sydney NSW — Demo Community Point", 8, 15, 5, 48),
    ("Museum Station", StationType.TRAIN_STATION, -33.8748, 151.2127,
     "Liverpool St, Sydney NSW — Demo Community Point", 0, 26, 30, 96),
    ("Redfern Station", StationType.TRAIN_STATION, -33.8932, 151.1985,
     "Lawson St, Redfern NSW — Demo Community Point", 5, 12, 8, 60),
    ("Central Bus Interchange", StationType.BUS_STATION, -33.8822, 151.2045,
     "Railway Square, Haymarket NSW — Demo Community Point", 2, 14, 4, 40),
]


def seed_if_empty(db: Session) -> bool:
    if db.scalar(select(Station.id).limit(1)) is not None:
        return False

    donor = User(role=UserRole.DONOR)
    champion_user = User(role=UserRole.CHAMPION)
    db.add_all([donor, champion_user])
    db.flush()

    for name, stype, lat, lng, address, supply, demand, verified_h, restocked_h in DEMO_STATIONS:
        station = Station(
            name=name,
            type=stype,
            latitude=lat,
            longitude=lng,
            address=address,
            current_supply=supply,
            estimated_demand=demand,
            last_verified_at=NOW - timedelta(hours=verified_h),
            last_restocked_at=NOW - timedelta(hours=restocked_h),
        )
        station.supply_status = derive_supply_status(supply, True)
        db.add(station)
        db.flush()

        db.add(SupplyReport(
            station_id=station.id,
            reported_supply=supply,
            report_type=ReporterType.CHAMPION if name != "Museum Station" else ReporterType.ANONYMOUS,
            confidence=Confidence.HIGH if name != "Museum Station" else Confidence.LOW,
            created_at=NOW - timedelta(hours=verified_h),
        ))
        db.add(Donation(
            donor_id=donor.id,
            station_id=station.id,
            quantity=max(supply, 5),
            status=DonationStatus.VERIFIED,
            created_at=NOW - timedelta(hours=restocked_h),
            verified_at=NOW - timedelta(hours=restocked_h - 1),
        ))
        # Recent demand pressure at high-need stations
        request_count = 9 if supply == 0 else (3 if supply < 5 else 1)
        for i in range(request_count):
            db.add(Request(
                station_id=station.id,
                request_type=RequestType.NEED_SEARCH,
                created_at=NOW - timedelta(hours=2 * i + 1),
            ))
        if name in ("Central Station", "Town Hall Station", "Redfern Station"):
            db.add(Champion(
                user_id=champion_user.id,
                station_id=station.id,
                status="ACTIVE",
                verified_at=NOW - timedelta(days=3),
            ))
        recompute_need_score(db, station)

    db.commit()
    return True

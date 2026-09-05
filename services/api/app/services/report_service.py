"""Community supply reports with a simple trust model."""
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models import Confidence, ReporterType, Station, SupplyReport, SupplyStatus
from app.services.station_service import derive_supply_status, recompute_need_score

BASE_CONFIDENCE = {
    ReporterType.ANONYMOUS: Confidence.LOW,
    ReporterType.DONOR: Confidence.MEDIUM,
    ReporterType.CHAMPION: Confidence.HIGH,
}


def create_supply_report(
    db: Session,
    station: Station,
    reported_supply: int | None,
    report_type: ReporterType,
    user_id: int | None = None,
) -> SupplyReport:
    report = SupplyReport(
        station_id=station.id,
        reported_supply=reported_supply,
        report_type=report_type,
        confidence=Confidence.LOW if reported_supply is None else BASE_CONFIDENCE[report_type],
        user_id=user_id,
    )
    db.add(report)

    if reported_supply is None:
        # "Not sure" — the reporter can't confirm the amount; mark supply unknown
        # without overwriting the last known count.
        station.supply_status = SupplyStatus.UNKNOWN
    else:
        station.current_supply = reported_supply
        station.supply_status = derive_supply_status(reported_supply, True)
    station.last_verified_at = datetime.now(timezone.utc)
    recompute_need_score(db, station)

    db.commit()
    db.refresh(report)
    return report

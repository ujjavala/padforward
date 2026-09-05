"""Donation logic: creating a donation updates station supply, status and need score."""
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models import Donation, DonationStatus, PaymentMethod, Station, SupplyStatus
from app.schemas.schemas import DonationOut, DonationResult
from app.scoring.need_score import classify_need
from app.services import solana_service
from app.services.station_service import (
    derive_supply_status,
    recompute_need_score,
    to_station_out,
)


def create_donation(
    db: Session,
    station: Station,
    quantity: int,
    donor_id: int | None = None,
    payment_method: PaymentMethod = PaymentMethod.IN_PERSON,
    wallet_address: str | None = None,
) -> DonationResult:
    before = {
        "supply_status": station.supply_status.value,
        "need_score": station.need_score,
        "need_level": classify_need(station.need_score),
        "current_supply": station.current_supply,
    }

    sol_amount: float | None = None
    tx_signature: str | None = None
    if payment_method == PaymentMethod.SOL:
        sol_amount, tx_signature = solana_service.process_payment(quantity, wallet_address)

    now = datetime.now(timezone.utc)
    donation = Donation(
        donor_id=donor_id,
        station_id=station.id,
        quantity=quantity,
        status=DonationStatus.DELIVERED,
        payment_method=payment_method,
        sol_amount=sol_amount,
        tx_signature=tx_signature,
    )
    db.add(donation)

    station.current_supply += quantity
    station.supply_status = derive_supply_status(station.current_supply, True)
    station.last_restocked_at = now
    station.last_verified_at = now
    recompute_need_score(db, station)

    db.commit()
    db.refresh(donation)
    db.refresh(station)

    after = to_station_out(db, station)
    if payment_method == PaymentMethod.SOL:
        message = (
            f"Your {sol_amount} SOL funded {quantity} pads at {station.name}. "
            "Someone may need one of these today. Thank you for paying it forward."
        )
    elif before["supply_status"] in (SupplyStatus.NONE.value, SupplyStatus.UNKNOWN.value):
        message = (
            f"{quantity} pads added to the PadForward network. "
            f"{station.name} is now {after.supply_status.value.replace('_', ' ').title()}. "
            "Someone may need one of these today. Thank you for paying it forward."
        )
    else:
        message = (
            f"{quantity} pads are now available through the community network at {station.name}. "
            "Thank you for paying it forward."
        )

    return DonationResult(
        donation=DonationOut.model_validate(donation),
        station_before=before,
        station_after=after,
        message=message,
    )

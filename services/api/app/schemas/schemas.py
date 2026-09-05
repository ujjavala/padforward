"""Pydantic API schemas — strongly typed contracts."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models import (
    Confidence,
    DonationStatus,
    PaymentMethod,
    ReporterType,
    StationType,
    SupplyStatus,
)


class StationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    type: StationType
    latitude: float
    longitude: float
    address: str
    current_supply: int
    supply_status: SupplyStatus
    need_score: int
    need_level: str = "MODERATE"
    estimated_demand: int
    last_verified_at: datetime | None
    last_restocked_at: datetime | None
    community_confidence: str = "LOW"
    champion_count: int = 0
    distance_km: float | None = None
    walking_minutes: int | None = None


class NearbyQuery(BaseModel):
    latitude: float
    longitude: float
    radius_km: float = Field(default=5.0, gt=0, le=50)


class SupplyReportIn(BaseModel):
    # None means "not sure" — marks the station's supply as UNKNOWN.
    reported_supply: int | None = Field(default=None, ge=0, le=500)
    report_type: ReporterType = ReporterType.ANONYMOUS


class SupplyReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    station_id: int
    reported_supply: int | None
    report_type: ReporterType
    confidence: Confidence
    created_at: datetime


class DonationIn(BaseModel):
    station_id: int
    quantity: int = Field(gt=0, le=1000)
    donor_id: int | None = None
    payment_method: PaymentMethod = PaymentMethod.IN_PERSON
    wallet_address: str | None = Field(default=None, max_length=64)


class DonationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    station_id: int
    quantity: int
    status: DonationStatus
    payment_method: PaymentMethod
    sol_amount: float | None
    tx_signature: str | None
    created_at: datetime


class SolQuoteOut(BaseModel):
    quantity: int
    sol_amount: float
    sol_price_usd: float
    pad_price_usd: float
    network: str
    demo: bool


class DonationResult(BaseModel):
    donation: DonationOut
    station_before: dict
    station_after: StationOut
    message: str


class AdoptIn(BaseModel):
    user_id: int | None = None


class ClaimIn(BaseModel):
    remaining_supply: int | None = Field(default=None, ge=0, le=500)


class ImpactOut(BaseModel):
    stations: int
    donors: int
    champions: int
    pads_donated: int
    donations: int
    restocks: int
    requests_fulfilled: int
    today_pads_donated: int
    today_supply_reports: int
    today_restocks: int
    urgent_stations: list[StationOut]
    demo_network: bool = True


class AIQueryIn(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    latitude: float | None = None
    longitude: float | None = None


class AIToolCall(BaseModel):
    tool: str
    args: dict


class AIQueryOut(BaseModel):
    reply: str
    intent: str | None = None
    tool_calls: list[AIToolCall] = []
    stations: list[StationOut] = []
    provider: str = "fallback"


class RouteSearchIn(BaseModel):
    origin_lat: float
    origin_lng: float
    dest_lat: float
    dest_lng: float
    max_detour_km: float = Field(default=1.5, gt=0, le=10)

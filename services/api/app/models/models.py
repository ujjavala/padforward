"""SQLAlchemy models for the PadForward network."""
import enum
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class SupplyStatus(str, enum.Enum):
    PLENTY = "PLENTY"
    A_FEW = "A_FEW"
    NONE = "NONE"
    UNKNOWN = "UNKNOWN"


class StationType(str, enum.Enum):
    TRAIN_STATION = "TRAIN_STATION"
    BUS_STATION = "BUS_STATION"
    COMMUNITY_POINT = "COMMUNITY_POINT"


class ReporterType(str, enum.Enum):
    ANONYMOUS = "ANONYMOUS"
    DONOR = "DONOR"
    CHAMPION = "CHAMPION"


class Confidence(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class UserRole(str, enum.Enum):
    DONOR = "DONOR"
    CHAMPION = "CHAMPION"
    ADMIN = "ADMIN"


class DonationStatus(str, enum.Enum):
    PLEDGED = "PLEDGED"
    DELIVERED = "DELIVERED"
    VERIFIED = "VERIFIED"


class PaymentMethod(str, enum.Enum):
    IN_PERSON = "IN_PERSON"
    SOL = "SOL"


class RequestType(str, enum.Enum):
    PAD_CLAIMED = "PAD_CLAIMED"
    SHORTAGE_REPORTED = "SHORTAGE_REPORTED"
    NEED_SEARCH = "NEED_SEARCH"


class Station(Base):
    __tablename__ = "stations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    google_place_id: Mapped[str | None] = mapped_column(String, nullable=True)
    name: Mapped[str] = mapped_column(String, index=True)
    type: Mapped[StationType] = mapped_column(Enum(StationType), default=StationType.TRAIN_STATION)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    address: Mapped[str] = mapped_column(String, default="")
    current_supply: Mapped[int] = mapped_column(Integer, default=0)
    supply_status: Mapped[SupplyStatus] = mapped_column(Enum(SupplyStatus), default=SupplyStatus.UNKNOWN)
    need_score: Mapped[int] = mapped_column(Integer, default=50)
    estimated_demand: Mapped[int] = mapped_column(Integer, default=10)  # pads/day estimate
    last_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_restocked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    supply_reports: Mapped[list["SupplyReport"]] = relationship(back_populates="station")
    donations: Mapped[list["Donation"]] = relationship(back_populates="station")
    champions: Mapped[list["Champion"]] = relationship(back_populates="station")
    requests: Mapped[list["Request"]] = relationship(back_populates="station")


class SupplyReport(Base):
    __tablename__ = "supply_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    station_id: Mapped[int] = mapped_column(ForeignKey("stations.id"), index=True)
    reported_supply: Mapped[int | None] = mapped_column(Integer, nullable=True)
    report_type: Mapped[ReporterType] = mapped_column(Enum(ReporterType), default=ReporterType.ANONYMOUS)
    confidence: Mapped[Confidence] = mapped_column(Enum(Confidence), default=Confidence.LOW)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    station: Mapped[Station] = relationship(back_populates="supply_reports")


class Donation(Base):
    __tablename__ = "donations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    donor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    station_id: Mapped[int] = mapped_column(ForeignKey("stations.id"), index=True)
    quantity: Mapped[int] = mapped_column(Integer)
    status: Mapped[DonationStatus] = mapped_column(Enum(DonationStatus), default=DonationStatus.DELIVERED)
    payment_method: Mapped[PaymentMethod] = mapped_column(
        Enum(PaymentMethod), default=PaymentMethod.IN_PERSON
    )
    sol_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    tx_signature: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    station: Mapped[Station] = relationship(back_populates="donations")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.DONOR)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Champion(Base):
    __tablename__ = "champions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    station_id: Mapped[int] = mapped_column(ForeignKey("stations.id"), index=True)
    status: Mapped[str] = mapped_column(String, default="ACTIVE")
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    station: Mapped[Station] = relationship(back_populates="champions")


class Request(Base):
    __tablename__ = "requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    station_id: Mapped[int] = mapped_column(ForeignKey("stations.id"), index=True)
    request_type: Mapped[RequestType] = mapped_column(Enum(RequestType), default=RequestType.NEED_SEARCH)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    station: Mapped[Station] = relationship(back_populates="requests")

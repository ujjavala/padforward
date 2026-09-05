"""Deterministic Need Score engine.

Designed as an isolated module so it can later be replaced with an ML model.

Need Score (0-100) =
    40% supply shortage
  + 20% estimated demand
  + 15% time since verification
  + 15% recent requests
  + 10% historical demand
"""
from dataclasses import dataclass
from datetime import datetime, timezone

WEIGHTS = {
    "supply_shortage": 0.40,
    "estimated_demand": 0.20,
    "staleness": 0.15,
    "recent_requests": 0.15,
    "historical_demand": 0.10,
}

# Normalisation caps
DEMAND_CAP = 30          # pads/day considered "very high demand"
STALENESS_CAP_HOURS = 48  # unverified for 48h => fully stale
RECENT_REQUESTS_CAP = 10  # 10+ requests in 24h => maximum pressure


@dataclass(frozen=True)
class NeedInputs:
    current_supply: int
    estimated_demand: int
    last_verified_at: datetime | None
    recent_requests_24h: int
    historical_daily_demand: float
    now: datetime | None = None


def _clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


def supply_shortage_component(current_supply: int, estimated_demand: int) -> float:
    demand = max(estimated_demand, 1)
    ratio = current_supply / demand
    return _clamp((1 - ratio) * 100)


def demand_component(estimated_demand: int) -> float:
    return _clamp(estimated_demand / DEMAND_CAP * 100)


def staleness_component(last_verified_at: datetime | None, now: datetime) -> float:
    if last_verified_at is None:
        return 100.0
    verified = last_verified_at
    if verified.tzinfo is None:
        verified = verified.replace(tzinfo=timezone.utc)
    hours = (now - verified).total_seconds() / 3600
    return _clamp(hours / STALENESS_CAP_HOURS * 100)


def recent_requests_component(recent_requests_24h: int) -> float:
    return _clamp(recent_requests_24h / RECENT_REQUESTS_CAP * 100)


def historical_component(historical_daily_demand: float) -> float:
    return _clamp(historical_daily_demand / DEMAND_CAP * 100)


def compute_need_score(inputs: NeedInputs) -> int:
    now = inputs.now or datetime.now(timezone.utc)
    score = (
        WEIGHTS["supply_shortage"] * supply_shortage_component(inputs.current_supply, inputs.estimated_demand)
        + WEIGHTS["estimated_demand"] * demand_component(inputs.estimated_demand)
        + WEIGHTS["staleness"] * staleness_component(inputs.last_verified_at, now)
        + WEIGHTS["recent_requests"] * recent_requests_component(inputs.recent_requests_24h)
        + WEIGHTS["historical_demand"] * historical_component(inputs.historical_daily_demand)
    )
    return int(round(_clamp(score)))


def classify_need(score: int) -> str:
    if score <= 30:
        return "LOW"
    if score <= 60:
        return "MODERATE"
    if score <= 80:
        return "HIGH"
    return "CRITICAL"

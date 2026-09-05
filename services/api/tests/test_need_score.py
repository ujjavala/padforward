"""Need score engine tests."""
from datetime import datetime, timedelta, timezone

from app.scoring.need_score import NeedInputs, classify_need, compute_need_score

NOW = datetime.now(timezone.utc)


def make_inputs(**overrides) -> NeedInputs:
    defaults = dict(
        current_supply=10,
        estimated_demand=10,
        last_verified_at=NOW,
        recent_requests_24h=0,
        historical_daily_demand=10.0,
        now=NOW,
    )
    defaults.update(overrides)
    return NeedInputs(**defaults)


def test_empty_unverified_station_is_critical():
    score = compute_need_score(
        make_inputs(current_supply=0, estimated_demand=20, last_verified_at=None,
                    recent_requests_24h=8, historical_daily_demand=20.0)
    )
    assert score >= 81
    assert classify_need(score) == "CRITICAL"


def test_well_stocked_recent_station_is_low():
    score = compute_need_score(
        make_inputs(current_supply=30, estimated_demand=10, recent_requests_24h=0)
    )
    assert score <= 30
    assert classify_need(score) == "LOW"


def test_score_bounded_0_100():
    hi = compute_need_score(
        make_inputs(current_supply=0, estimated_demand=100, last_verified_at=None,
                    recent_requests_24h=50, historical_daily_demand=100.0)
    )
    lo = compute_need_score(
        make_inputs(current_supply=1000, estimated_demand=1, recent_requests_24h=0,
                    historical_daily_demand=0.0)
    )
    assert 0 <= lo <= 100
    assert 0 <= hi <= 100


def test_staleness_increases_score():
    fresh = compute_need_score(make_inputs())
    stale = compute_need_score(make_inputs(last_verified_at=NOW - timedelta(hours=48)))
    assert stale > fresh


def test_supply_reduces_score():
    empty = compute_need_score(make_inputs(current_supply=0))
    stocked = compute_need_score(make_inputs(current_supply=20))
    assert empty > stocked


def test_classification_boundaries():
    assert classify_need(0) == "LOW"
    assert classify_need(30) == "LOW"
    assert classify_need(31) == "MODERATE"
    assert classify_need(60) == "MODERATE"
    assert classify_need(61) == "HIGH"
    assert classify_need(80) == "HIGH"
    assert classify_need(81) == "CRITICAL"
    assert classify_need(100) == "CRITICAL"

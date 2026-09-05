"""AI agent tests — deterministic fallback engine and tool validation.

These run without a Gemini key; the Gemini path uses identical tools.
"""
from app.ai.agent import DeterministicAgent
from app.ai.tools import execute_tool

CENTRAL_LAT, CENTRAL_LNG = -33.8832, 151.2070


def agent() -> DeterministicAgent:
    return DeterministicAgent()


def test_intent_find_pad_with_location(db_session):
    out = agent().process(db_session, "I need a pad", CENTRAL_LAT, CENTRAL_LNG)
    assert out.intent == "FIND_PAD"
    assert any(c.tool == "find_nearby_stations" for c in out.tool_calls)
    assert "min walk" in out.reply or "min" in out.reply


def test_intent_find_pad_period_phrasing(db_session):
    out = agent().process(db_session, "I need something for my period", CENTRAL_LAT, CENTRAL_LNG)
    assert out.intent == "FIND_PAD"


def test_intent_find_pad_named_station_no_coords(db_session):
    out = agent().process(db_session, "I suddenly got my period and I'm at Central", None, None)
    assert out.intent == "FIND_PAD"
    assert any(c.tool == "get_station_status" for c in out.tool_calls)


def test_intent_donate_recommends_highest_need(db_session):
    out = agent().process(db_session, "I have 20 pads to donate. Where should I donate?", None, None)
    assert out.intent == "DONATE"
    assert any(c.tool == "get_highest_need_locations" for c in out.tool_calls)
    assert "Museum" in out.reply  # seeded highest-need station


def test_intent_supply_report_box_empty(db_session):
    out = agent().process(db_session, "The donation box at Town Hall is empty", None, None)
    assert out.intent == "SUPPLY_REPORT"
    assert any(c.tool == "report_supply_status" for c in out.tool_calls)
    status = execute_tool(db_session, "get_station_status", {"station_name": "Town Hall"})
    assert status["station"]["supply_status"] == "NONE"


def test_intent_route_search(db_session):
    out = agent().process(
        db_session,
        "I'm travelling from Redfern to Wynyard. Is there a pad along my route?",
        None, None,
    )
    assert out.intent == "ROUTE_SEARCH"
    assert any(c.tool == "find_locations_along_route" for c in out.tool_calls)


def test_no_location_asks_instead_of_inventing(db_session):
    out = agent().process(db_session, "I need a pad", None, None)
    assert out.intent == "FIND_PAD"
    assert out.tool_calls == []  # nothing invented without data


def test_tool_rejects_unknown_station(db_session):
    result = execute_tool(db_session, "get_station_status", {"station_name": "Hogwarts"})
    assert "error" in result


def test_tool_rejects_invalid_donation(db_session):
    result = execute_tool(db_session, "create_donation", {"station_name": "Central", "quantity": -5})
    assert "error" in result


def test_tool_rejects_unknown_tool(db_session):
    result = execute_tool(db_session, "drop_all_tables", {})
    assert "error" in result

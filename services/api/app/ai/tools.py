"""Validated application tools exposed to the AI agent.

The model NEVER touches the database directly — every action goes through
these functions, which delegate to the same validated service layer used
by the REST API. If no data exists, tools say so; the agent must not invent
availability.
"""
from typing import Any

from sqlalchemy.orm import Session

from app.models import ReporterType, Station
from app.schemas.schemas import StationOut
from app.services import (
    champion_service,
    donation_service,
    impact_service,
    report_service,
    station_service,
)


def _station_dict(s: StationOut) -> dict[str, Any]:
    return {
        "id": s.id,
        "name": s.name,
        "type": s.type.value,
        "supply_status": s.supply_status.value,
        "current_supply": s.current_supply,
        "need_score": s.need_score,
        "need_level": s.need_level,
        "community_confidence": s.community_confidence,
        "champion_count": s.champion_count,
        "distance_km": s.distance_km,
        "walking_minutes": s.walking_minutes,
        "last_verified_at": s.last_verified_at.isoformat() if s.last_verified_at else None,
        "latitude": s.latitude,
        "longitude": s.longitude,
    }


def _resolve_station(db: Session, station_id: int | None, station_name: str | None) -> Station | None:
    if station_id is not None:
        return station_service.get_station(db, int(station_id))
    if station_name:
        from sqlalchemy import select

        stations = db.scalars(select(Station)).all()
        needle = station_name.lower().strip()
        for s in stations:
            if needle in s.name.lower():
                return s
    return None


def find_nearby_stations(
    db: Session, latitude: float, longitude: float, radius_km: float = 5.0
) -> dict:
    stations = station_service.find_nearby(db, latitude, longitude, radius_km)
    return {"stations": [_station_dict(s) for s in stations]}


def get_station_status(db: Session, station_id: int | None = None, station_name: str | None = None) -> dict:
    station = _resolve_station(db, station_id, station_name)
    if station is None:
        return {"error": "No matching station found. I don't have data for that location."}
    return {"station": _station_dict(station_service.to_station_out(db, station))}


def get_station_facilities(db: Session, station_id: int | None = None, station_name: str | None = None) -> dict:
    station = _resolve_station(db, station_id, station_name)
    if station is None:
        return {"error": "No matching station found."}
    return {
        "station": station.name,
        "type": station.type.value,
        "address": station.address,
        "padforward_point": True,
        "demo_community_point": True,
    }


def get_walking_route(
    db: Session,
    origin_lat: float,
    origin_lng: float,
    station_id: int | None = None,
    station_name: str | None = None,
) -> dict:
    station = _resolve_station(db, station_id, station_name)
    if station is None:
        return {"error": "No matching station found."}
    from app.maps.geo import haversine_km, walking_minutes

    dist = haversine_km(origin_lat, origin_lng, station.latitude, station.longitude)
    return {
        "station": station.name,
        "distance_km": round(dist, 2),
        "walking_minutes": walking_minutes(dist),
        "directions_url": (
            "https://www.google.com/maps/dir/?api=1"
            f"&origin={origin_lat},{origin_lng}"
            f"&destination={station.latitude},{station.longitude}&travelmode=walking"
        ),
    }


def calculate_station_need(db: Session, station_id: int | None = None, station_name: str | None = None) -> dict:
    station = _resolve_station(db, station_id, station_name)
    if station is None:
        return {"error": "No matching station found."}
    station_service.recompute_need_score(db, station)
    db.commit()
    out = station_service.to_station_out(db, station)
    return {"station": station.name, "need_score": out.need_score, "need_level": out.need_level}


def get_highest_need_locations(
    db: Session, latitude: float | None = None, longitude: float | None = None, limit: int = 3
) -> dict:
    stations = station_service.highest_need(db, latitude, longitude, int(limit))
    return {"stations": [_station_dict(s) for s in stations]}


def create_donation(
    db: Session, station_id: int | None = None, station_name: str | None = None, quantity: int = 1
) -> dict:
    station = _resolve_station(db, station_id, station_name)
    if station is None:
        return {"error": "No matching station found — donation not recorded."}
    if quantity <= 0 or quantity > 1000:
        return {"error": "Quantity must be between 1 and 1000."}
    result = donation_service.create_donation(db, station, int(quantity))
    return {
        "donation_id": result.donation.id,
        "station": station.name,
        "quantity": quantity,
        "before": result.station_before,
        "after": _station_dict(result.station_after),
        "message": result.message,
    }


def report_supply_status(
    db: Session,
    reported_supply: int,
    station_id: int | None = None,
    station_name: str | None = None,
) -> dict:
    station = _resolve_station(db, station_id, station_name)
    if station is None:
        return {"error": "No matching station found — report not recorded."}
    if reported_supply < 0 or reported_supply > 500:
        return {"error": "Reported supply must be between 0 and 500."}
    report = report_service.create_supply_report(
        db, station, int(reported_supply), ReporterType.ANONYMOUS
    )
    return {
        "recorded": True,
        "station": station.name,
        "reported_supply": report.reported_supply,
        "new_status": station.supply_status.value,
        "need_score": station.need_score,
    }


def adopt_station(db: Session, station_id: int | None = None, station_name: str | None = None) -> dict:
    station = _resolve_station(db, station_id, station_name)
    if station is None:
        return {"error": "No matching station found."}
    champion_service.adopt_station(db, station)
    return {
        "adopted": True,
        "station": station.name,
        "champion_count": champion_service.champion_count(db, station.id),
    }


def get_user_impact(db: Session) -> dict:
    impact = impact_service.get_impact(db)
    return {
        "stations": impact.stations,
        "donors": impact.donors,
        "champions": impact.champions,
        "pads_donated": impact.pads_donated,
        "requests_fulfilled": impact.requests_fulfilled,
        "demo_network": impact.demo_network,
    }


def find_locations_along_route(
    db: Session,
    origin_lat: float | None = None,
    origin_lng: float | None = None,
    dest_lat: float | None = None,
    dest_lng: float | None = None,
    origin_name: str | None = None,
    dest_name: str | None = None,
    max_detour_km: float = 1.5,
) -> dict:
    if origin_name and (origin_lat is None or origin_lng is None):
        s = _resolve_station(db, None, origin_name)
        if s:
            origin_lat, origin_lng = s.latitude, s.longitude
    if dest_name and (dest_lat is None or dest_lng is None):
        s = _resolve_station(db, None, dest_name)
        if s:
            dest_lat, dest_lng = s.latitude, s.longitude
    if None in (origin_lat, origin_lng, dest_lat, dest_lng):
        return {"error": "I couldn't resolve both ends of that route."}
    stations = station_service.find_along_route(
        db, (origin_lat, origin_lng), (dest_lat, dest_lng), max_detour_km
    )
    return {"stations": [_station_dict(s) for s in stations]}


# Registry: name -> (callable, description, parameter schema)
TOOL_REGISTRY: dict[str, dict] = {
    "find_nearby_stations": {
        "fn": find_nearby_stations,
        "description": "Find PadForward community supply points near a latitude/longitude.",
        "parameters": {
            "type": "object",
            "properties": {
                "latitude": {"type": "number"},
                "longitude": {"type": "number"},
                "radius_km": {"type": "number"},
            },
            "required": ["latitude", "longitude"],
        },
    },
    "get_station_status": {
        "fn": get_station_status,
        "description": "Get current community supply status, need score and confidence for a station by id or name.",
        "parameters": {
            "type": "object",
            "properties": {
                "station_id": {"type": "integer"},
                "station_name": {"type": "string"},
            },
        },
    },
    "get_station_facilities": {
        "fn": get_station_facilities,
        "description": "Get facility information for a station.",
        "parameters": {
            "type": "object",
            "properties": {
                "station_id": {"type": "integer"},
                "station_name": {"type": "string"},
            },
        },
    },
    "get_walking_route": {
        "fn": get_walking_route,
        "description": "Get walking distance, time and a directions link from an origin to a station.",
        "parameters": {
            "type": "object",
            "properties": {
                "origin_lat": {"type": "number"},
                "origin_lng": {"type": "number"},
                "station_id": {"type": "integer"},
                "station_name": {"type": "string"},
            },
            "required": ["origin_lat", "origin_lng"],
        },
    },
    "calculate_station_need": {
        "fn": calculate_station_need,
        "description": "Recalculate and return the need score for a station.",
        "parameters": {
            "type": "object",
            "properties": {
                "station_id": {"type": "integer"},
                "station_name": {"type": "string"},
            },
        },
    },
    "get_highest_need_locations": {
        "fn": get_highest_need_locations,
        "description": "Get the locations where donations are needed most, optionally near a coordinate.",
        "parameters": {
            "type": "object",
            "properties": {
                "latitude": {"type": "number"},
                "longitude": {"type": "number"},
                "limit": {"type": "integer"},
            },
        },
    },
    "create_donation": {
        "fn": create_donation,
        "description": "Record a pad donation to a station. Only call when the user explicitly confirms they want to donate to a specific station.",
        "parameters": {
            "type": "object",
            "properties": {
                "station_id": {"type": "integer"},
                "station_name": {"type": "string"},
                "quantity": {"type": "integer"},
            },
            "required": ["quantity"],
        },
    },
    "report_supply_status": {
        "fn": report_supply_status,
        "description": "Record a community supply report for a station (e.g. the box is empty => reported_supply 0).",
        "parameters": {
            "type": "object",
            "properties": {
                "station_id": {"type": "integer"},
                "station_name": {"type": "string"},
                "reported_supply": {"type": "integer"},
            },
            "required": ["reported_supply"],
        },
    },
    "adopt_station": {
        "fn": adopt_station,
        "description": "Register the user as a Pad Champion for a station.",
        "parameters": {
            "type": "object",
            "properties": {
                "station_id": {"type": "integer"},
                "station_name": {"type": "string"},
            },
        },
    },
    "get_user_impact": {
        "fn": get_user_impact,
        "description": "Get network-wide community impact statistics.",
        "parameters": {"type": "object", "properties": {}},
    },
    "find_locations_along_route": {
        "fn": find_locations_along_route,
        "description": "Find PadForward locations along a route between two places (by station names or coordinates) with minimal detour.",
        "parameters": {
            "type": "object",
            "properties": {
                "origin_name": {"type": "string"},
                "dest_name": {"type": "string"},
                "origin_lat": {"type": "number"},
                "origin_lng": {"type": "number"},
                "dest_lat": {"type": "number"},
                "dest_lng": {"type": "number"},
                "max_detour_km": {"type": "number"},
            },
        },
    },
}


def execute_tool(db: Session, name: str, args: dict) -> dict:
    entry = TOOL_REGISTRY.get(name)
    if entry is None:
        return {"error": f"Unknown tool: {name}"}
    try:
        return entry["fn"](db, **args)
    except TypeError as exc:
        return {"error": f"Invalid arguments for {name}: {exc}"}

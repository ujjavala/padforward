"""AI-assisted station discovery.

When a nearby search finds no community points (the seed data only covers
Sydney CBD), we bootstrap demo community points around the user's actual
location so the product works anywhere:

1. Live OpenStreetMap (Overpass API) lookup: real train stations and bus
   stops near the user — free, no API key.
2. Gemini path: asks the model for real nearby train/bus stations when a
   GEMINI_API_KEY is configured.
3. Deterministic simulation: plausible transit-style points at realistic
   offsets, seeded from the coordinates so results are stable per location.

Either way, stations are persisted with clearly-labelled demo supply data,
exactly like the seed — real locations, simulated inventory.
"""
import hashlib
import json
import logging
import math
import random
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import (
    Confidence,
    ReporterType,
    Request,
    RequestType,
    Station,
    StationType,
    SupplyReport,
)
from app.services.station_service import derive_supply_status, recompute_need_score

logger = logging.getLogger(__name__)

# name suffix, type, bearing (deg), distance (km)
_FALLBACK_SPOTS = [
    ("Central", StationType.TRAIN_STATION, 40, 0.4),
    ("North", StationType.TRAIN_STATION, 0, 1.1),
    ("South", StationType.BUS_STATION, 180, 0.7),
    ("East Interchange", StationType.BUS_STATION, 95, 1.4),
    ("West", StationType.TRAIN_STATION, 265, 1.8),
]

# supply, estimated demand, verified hours ago — mirrors the Sydney seed mix
_SUPPLY_PROFILES = [(10, 18, 1), (3, 15, 4), (0, 22, 26), (6, 12, 7), (2, 14, 5)]


def _offset(lat: float, lng: float, bearing_deg: float, dist_km: float) -> tuple[float, float]:
    d_lat = (dist_km / 111.32) * math.cos(math.radians(bearing_deg))
    d_lng = (dist_km / (111.32 * max(0.2, math.cos(math.radians(lat))))) * math.sin(
        math.radians(bearing_deg)
    )
    return lat + d_lat, lng + d_lng


def _osm_candidates(lat: float, lng: float, radius_m: int = 3000) -> list[dict] | None:
    """Fetch real train stations / bus stops near the user from OpenStreetMap.

    Uses the public Overpass API (no key required). Returns None on any
    failure or if nothing is found, so callers fall through to the next source.
    """
    query = (
        f"[out:json][timeout:8];"
        f"(nwr[railway=station](around:{radius_m},{lat},{lng});"
        f"nwr[railway=halt](around:{radius_m},{lat},{lng});)->.trains;"
        f".trains out center 10;"
        f"(node[highway=bus_stop][name](around:{radius_m},{lat},{lng});"
        f"nwr[amenity=bus_station](around:{radius_m},{lat},{lng});)->.buses;"
        f".buses out center 15;"
    )
    try:
        resp = httpx.post(
            "https://overpass-api.de/api/interpreter",
            data={"data": query},
            headers={"User-Agent": "PadForward-demo/1.0 (community hackathon project)"},
            timeout=8.0,
        )
        resp.raise_for_status()
        elements = resp.json().get("elements", [])
    except Exception:  # noqa: BLE001 — network/parse failure falls through
        logger.warning("Overpass lookup failed; trying next discovery source", exc_info=True)
        return None

    seen: set[str] = set()
    trains: list[dict] = []
    buses: list[dict] = []
    for el in elements:
        tags = el.get("tags", {})
        name = tags.get("name")
        el_lat = el.get("lat") or el.get("center", {}).get("lat")
        el_lng = el.get("lon") or el.get("center", {}).get("lon")
        if not name or name in seen or el_lat is None or el_lng is None:
            continue
        seen.add(name)
        is_train = tags.get("railway") in ("station", "halt")
        candidate = {
            "name": str(name)[:80],
            "type": StationType.TRAIN_STATION if is_train else StationType.BUS_STATION,
            "latitude": float(el_lat),
            "longitude": float(el_lng),
            "address": "Real location via OpenStreetMap — Demo Community Point",
        }
        (trains if is_train else buses).append(candidate)

    # Prefer train stations, top up with bus stops, nearest-first
    def dist(c: dict) -> float:
        return (c["latitude"] - lat) ** 2 + (c["longitude"] - lng) ** 2

    trains.sort(key=dist)
    buses.sort(key=dist)
    picked = (trains + buses)[:5]
    return picked or None


def _gemini_candidates(lat: float, lng: float) -> list[dict] | None:
    """Ask Gemini for real nearby transit stations. Returns None on any failure."""
    settings = get_settings()
    if not settings.gemini_enabled:
        return None
    try:
        from google import genai

        client = genai.Client(api_key=settings.gemini_api_key)
        prompt = (
            "List up to 5 real train or bus stations within 3 km of "
            f"latitude {lat}, longitude {lng}. Respond ONLY with a JSON array of objects "
            'with keys: "name" (string), "type" ("TRAIN_STATION" or "BUS_STATION"), '
            '"latitude" (number), "longitude" (number), "address" (string, short).'
        )
        response = client.models.generate_content(
            model="gemini-2.0-flash", contents=prompt
        )
        text = (response.text or "").strip()
        if text.startswith("```"):
            text = text.strip("`").removeprefix("json").strip()
        candidates = json.loads(text)
        cleaned = []
        for c in candidates[:5]:
            name = str(c["name"])[:80]
            stype = (
                StationType.BUS_STATION
                if c.get("type") == "BUS_STATION"
                else StationType.TRAIN_STATION
            )
            c_lat, c_lng = float(c["latitude"]), float(c["longitude"])
            # Reject anything implausibly far from the user (model hallucination guard)
            if abs(c_lat - lat) > 0.1 or abs(c_lng - lng) > 0.1:
                continue
            cleaned.append(
                {
                    "name": name,
                    "type": stype,
                    "latitude": c_lat,
                    "longitude": c_lng,
                    "address": f"{str(c.get('address', ''))[:120]} — Demo Community Point",
                }
            )
        return cleaned or None
    except Exception:  # noqa: BLE001 — any AI failure falls back to simulation
        logger.warning("Gemini station discovery failed; using simulated stations", exc_info=True)
        return None


def _simulated_candidates(lat: float, lng: float) -> list[dict]:
    """Deterministic simulated transit points around the user's location."""
    seed = hashlib.sha256(f"{round(lat, 3)},{round(lng, 3)}".encode()).hexdigest()
    rng = random.Random(seed)
    area = f"Area {seed[:4].upper()}"
    candidates = []
    for suffix, stype, bearing, dist in _FALLBACK_SPOTS:
        b = bearing + rng.uniform(-15, 15)
        d = dist * rng.uniform(0.8, 1.2)
        c_lat, c_lng = _offset(lat, lng, b, d)
        kind = "Station" if stype == StationType.TRAIN_STATION else "Bus Stop"
        candidates.append(
            {
                "name": f"{area} {suffix} {kind}",
                "type": stype,
                "latitude": c_lat,
                "longitude": c_lng,
                "address": "Simulated location near you — Demo Community Point",
            }
        )
    return candidates


def discover_stations(db: Session, lat: float, lng: float) -> int:
    """Create demo community points around (lat, lng). Returns how many were added."""
    candidates = (
        _osm_candidates(lat, lng)
        or _gemini_candidates(lat, lng)
        or _simulated_candidates(lat, lng)
    )
    now = datetime.now(timezone.utc)
    created = 0
    for candidate, (supply, demand, verified_h) in zip(candidates, _SUPPLY_PROFILES):
        station = Station(
            name=candidate["name"],
            type=candidate["type"],
            latitude=candidate["latitude"],
            longitude=candidate["longitude"],
            address=candidate["address"],
            current_supply=supply,
            estimated_demand=demand,
            last_verified_at=now - timedelta(hours=verified_h),
            last_restocked_at=now - timedelta(hours=verified_h + 12),
        )
        station.supply_status = derive_supply_status(supply, True)
        db.add(station)
        db.flush()
        db.add(
            SupplyReport(
                station_id=station.id,
                reported_supply=supply,
                report_type=ReporterType.ANONYMOUS,
                confidence=Confidence.MEDIUM,
                created_at=now - timedelta(hours=verified_h),
            )
        )
        request_count = 6 if supply == 0 else (2 if supply < 5 else 1)
        for i in range(request_count):
            db.add(
                Request(
                    station_id=station.id,
                    request_type=RequestType.NEED_SEARCH,
                    created_at=now - timedelta(hours=2 * i + 1),
                )
            )
        recompute_need_score(db, station)
        created += 1
    db.commit()
    return created

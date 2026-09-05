"""Geographic helpers. Google Maps provides places/routing on the frontend;
the backend keeps a dependency-free haversine fallback so the app always works.
"""
import math

WALKING_SPEED_KMH = 4.8


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def walking_minutes(distance_km: float) -> int:
    return max(1, int(round(distance_km / WALKING_SPEED_KMH * 60)))


def point_to_segment_km(
    lat: float, lon: float, lat1: float, lon1: float, lat2: float, lon2: float
) -> float:
    """Approximate distance from a point to a route segment (equirectangular projection)."""
    kx = math.cos(math.radians(lat)) * 111.32
    ky = 110.57
    ax, ay = (lon1 - lon) * kx, (lat1 - lat) * ky
    bx, by = (lon2 - lon) * kx, (lat2 - lat) * ky
    dx, dy = bx - ax, by - ay
    seg_len_sq = dx * dx + dy * dy
    if seg_len_sq == 0:
        return math.hypot(ax, ay)
    t = max(0.0, min(1.0, -(ax * dx + ay * dy) / seg_len_sq))
    return math.hypot(ax + t * dx, ay + t * dy)

// Geographic helpers — port of services/api/app/maps/geo.py

const WALKING_SPEED_KMH = 4.8;

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = 6371.0;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

export function walkingMinutes(distanceKm: number): number {
  return Math.max(1, Math.round((distanceKm / WALKING_SPEED_KMH) * 60));
}

/** Approximate distance from a point to a route segment (equirectangular projection). */
export function pointToSegmentKm(
  lat: number,
  lon: number,
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const kx = Math.cos((lat * Math.PI) / 180) * 111.32;
  const ky = 110.57;
  const ax = (lon1 - lon) * kx;
  const ay = (lat1 - lat) * ky;
  const bx = (lon2 - lon) * kx;
  const by = (lat2 - lat) * ky;
  const dx = bx - ax;
  const dy = by - ay;
  const segLenSq = dx * dx + dy * dy;
  if (segLenSq === 0) return Math.hypot(ax, ay);
  const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / segLenSq));
  return Math.hypot(ax + t * dx, ay + t * dy);
}

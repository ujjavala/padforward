import { NextRequest, NextResponse } from "next/server";

import { discoverStations } from "../../../../server/discovery";
import { findNearby, getStore } from "../../../../server/stations";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const latitude = Number(p.get("latitude"));
  const longitude = Number(p.get("longitude"));
  const radiusKm = Number(p.get("radius_km") ?? 5);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json({ detail: "latitude and longitude are required" }, { status: 422 });
  }
  const store = getStore();
  let stations = findNearby(store, latitude, longitude, radiusKm);
  if (!stations.length) {
    // AI-assisted discovery: bootstrap demo community points around the
    // user's real location (OSM → Gemini → simulated).
    await discoverStations(store, latitude, longitude);
    stations = findNearby(store, latitude, longitude, radiusKm);
  }
  return NextResponse.json(stations);
}

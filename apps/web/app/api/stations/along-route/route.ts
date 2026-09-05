import { NextRequest, NextResponse } from "next/server";

import { findAlongRoute, getStore } from "../../../../server/stations";

export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const originLat = Number(p.get("origin_lat"));
  const originLng = Number(p.get("origin_lng"));
  const destLat = Number(p.get("dest_lat"));
  const destLng = Number(p.get("dest_lng"));
  const maxDetourKm = Number(p.get("max_detour_km") ?? 1.5);
  if (![originLat, originLng, destLat, destLng].every(Number.isFinite)) {
    return NextResponse.json({ detail: "origin and destination are required" }, { status: 422 });
  }
  return NextResponse.json(
    findAlongRoute(getStore(), [originLat, originLng], [destLat, destLng], maxDetourKm)
  );
}

import { NextRequest, NextResponse } from "next/server";

import { discoverStations } from "../../../../server/discovery";
import { getStore, highestNeed } from "../../../../server/stations";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const latitude = p.get("latitude") !== null ? Number(p.get("latitude")) : undefined;
  const longitude = p.get("longitude") !== null ? Number(p.get("longitude")) : undefined;
  const limit = Number(p.get("limit") ?? 5);
  const store = getStore();

  if (latitude !== undefined && longitude !== undefined) {
    const radius = 8.0;
    let stations = highestNeed(store, latitude, longitude, limit, radius);
    if (!stations.length) {
      await discoverStations(store, latitude, longitude);
      stations = highestNeed(store, latitude, longitude, limit, radius);
    }
    if (stations.length) return NextResponse.json(stations);
  }
  return NextResponse.json(highestNeed(store, latitude, longitude, limit));
}

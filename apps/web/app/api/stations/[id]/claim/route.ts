import { NextRequest, NextResponse } from "next/server";

import {
  getStation,
  getStore,
  recordClaim,
  toStationOut,
} from "../../../../../server/stations";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const store = getStore();
  const station = getStation(store, Number(params.id));
  if (!station) return NextResponse.json({ detail: "Station not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const remaining =
    body.remaining_supply === undefined || body.remaining_supply === null
      ? null
      : Number(body.remaining_supply);
  if (remaining !== null && (remaining < 0 || remaining > 500)) {
    return NextResponse.json({ detail: "remaining_supply out of range" }, { status: 422 });
  }
  recordClaim(store, station, remaining);
  return NextResponse.json(toStationOut(store, station));
}

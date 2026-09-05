import { NextRequest, NextResponse } from "next/server";

import { getStation, getStore, toStationOut } from "../../../../server/stations";

export const dynamic = "force-dynamic";

export function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const store = getStore();
  const station = getStation(store, Number(params.id));
  if (!station) return NextResponse.json({ detail: "Station not found" }, { status: 404 });
  return NextResponse.json(toStationOut(store, station));
}

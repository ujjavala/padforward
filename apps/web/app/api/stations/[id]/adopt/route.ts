import { NextRequest, NextResponse } from "next/server";

import {
  adoptStation,
  getStation,
  getStore,
  toStationOut,
} from "../../../../../server/stations";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const store = getStore();
  const station = getStation(store, Number(params.id));
  if (!station) return NextResponse.json({ detail: "Station not found" }, { status: 404 });
  adoptStation(store, station);
  return NextResponse.json(toStationOut(store, station), { status: 201 });
}

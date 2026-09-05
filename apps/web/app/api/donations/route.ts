import { NextRequest, NextResponse } from "next/server";

import { createDonation } from "../../../server/donations";
import { getStation, getStore } from "../../../server/stations";
import type { PaymentMethod } from "../../../lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const stationId = Number(body.station_id);
  const quantity = Number(body.quantity);
  if (!Number.isFinite(stationId) || !Number.isFinite(quantity) || quantity <= 0 || quantity > 1000) {
    return NextResponse.json({ detail: "Invalid station_id or quantity" }, { status: 422 });
  }
  const store = getStore();
  const station = getStation(store, stationId);
  if (!station) return NextResponse.json({ detail: "Station not found" }, { status: 404 });
  const paymentMethod: PaymentMethod = body.payment_method === "SOL" ? "SOL" : "IN_PERSON";
  const result = createDonation(store, station, quantity, paymentMethod, body.wallet_address ?? null);
  return NextResponse.json(result, { status: 201 });
}

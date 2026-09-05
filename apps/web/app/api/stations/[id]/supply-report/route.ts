import { NextRequest, NextResponse } from "next/server";

import {
  createSupplyReport,
  getStation,
  getStore,
} from "../../../../../server/stations";
import type { ReporterType } from "../../../../../server/store";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const store = getStore();
  const station = getStation(store, Number(params.id));
  if (!station) return NextResponse.json({ detail: "Station not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const reportedSupply: number | null =
    body.reported_supply === undefined || body.reported_supply === null
      ? null
      : Number(body.reported_supply);
  if (reportedSupply !== null && (reportedSupply < 0 || reportedSupply > 500)) {
    return NextResponse.json({ detail: "reported_supply out of range" }, { status: 422 });
  }
  const reportType: ReporterType = ["ANONYMOUS", "DONOR", "CHAMPION"].includes(body.report_type)
    ? body.report_type
    : "ANONYMOUS";
  const report = createSupplyReport(store, station, reportedSupply, reportType);
  return NextResponse.json(
    { ...report, created_at: report.created_at.toISOString() },
    { status: 201 }
  );
}

import { NextResponse } from "next/server";

import { getImpact } from "../../../server/impact";
import { getStore } from "../../../server/store";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(getImpact(getStore()));
}

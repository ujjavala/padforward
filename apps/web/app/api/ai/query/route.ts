import { NextRequest, NextResponse } from "next/server";

import { processUserRequest } from "../../../../server/agent";
import { getStore } from "../../../../server/store";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message || message.length > 2000) {
    return NextResponse.json({ detail: "message is required (max 2000 chars)" }, { status: 422 });
  }
  const lat = body.latitude != null ? Number(body.latitude) : undefined;
  const lng = body.longitude != null ? Number(body.longitude) : undefined;
  const result = await processUserRequest(getStore(), message, lat, lng);
  return NextResponse.json(result);
}

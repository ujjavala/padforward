import { NextRequest, NextResponse } from "next/server";

import { solQuote } from "../../../../server/donations";

export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const quantity = Number(req.nextUrl.searchParams.get("quantity"));
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1000) {
    return NextResponse.json({ detail: "quantity must be between 1 and 1000" }, { status: 422 });
  }
  return NextResponse.json(solQuote(quantity));
}

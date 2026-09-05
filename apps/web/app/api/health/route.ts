import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    status: "ok",
    demo_mode: true,
    features: {
      gemini: Boolean(process.env.GEMINI_API_KEY),
      google_maps: Boolean(process.env.GOOGLE_MAPS_API_KEY),
      snowflake: false,
    },
  });
}

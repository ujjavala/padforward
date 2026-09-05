import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Photo → supply estimate using Gemini vision. The client falls back to the
// browser's built-in multimodal AI (Chrome Prompt API) when this returns 503.
const PROMPT =
  "This is a photo of a community menstrual-product donation box or shelf. " +
  "Count the visible menstrual pads/packages. Respond with ONLY a JSON object: " +
  '{"count": <integer, your best estimate of individual pads visible, 0 if empty>, ' +
  '"confidence": "high"|"medium"|"low", ' +
  '"description": "<one short sentence describing what you see>"} ' +
  "If the photo does not show a donation box or menstrual products at all, use count 0, " +
  'confidence "low", and say so in the description.';

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { detail: "Server vision AI is not configured" },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const image = typeof body.image === "string" ? body.image : "";
  const mimeType = typeof body.mime_type === "string" ? body.mime_type : "image/jpeg";
  // ~4MB base64 cap
  if (!image || image.length > 6_000_000 || !mimeType.startsWith("image/")) {
    return NextResponse.json(
      { detail: "image (base64) is required, max ~4MB" },
      { status: 422 }
    );
  }

  try {
    const { GoogleGenAI } = await import("@google/genai");
    const client = new GoogleGenAI({ apiKey });
    const response = await client.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          role: "user",
          parts: [{ inlineData: { mimeType, data: image } }, { text: PROMPT }],
        },
      ],
    });
    const text = response.text ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("no JSON in model response");
    const parsed = JSON.parse(match[0]);
    const count = Math.max(0, Math.min(500, Math.round(Number(parsed.count) || 0)));
    const confidence = ["high", "medium", "low"].includes(parsed.confidence)
      ? parsed.confidence
      : "low";
    return NextResponse.json({
      count,
      confidence,
      description: String(parsed.description ?? "").slice(0, 300),
      provider: "gemini-vision",
    });
  } catch {
    return NextResponse.json({ detail: "Vision analysis failed" }, { status: 502 });
  }
}

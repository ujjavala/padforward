import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseEstimate } from "../lib/visionReport";
import { POST } from "../app/api/ai/vision-report/route";

describe("parseEstimate", () => {
  it("parses a clean JSON response", () => {
    const result = parseEstimate(
      '{"count": 12, "confidence": "high", "description": "A well-stocked box."}',
      "gemini-vision"
    );
    expect(result).toEqual({
      count: 12,
      confidence: "high",
      description: "A well-stocked box.",
      provider: "gemini-vision",
    });
  });

  it("extracts JSON wrapped in prose/markdown", () => {
    const result = parseEstimate(
      'Sure! Here is the analysis:\n```json\n{"count": 3, "confidence": "medium", "description": "A few pads."}\n```',
      "browser-ai-vision"
    );
    expect(result?.count).toBe(3);
    expect(result?.provider).toBe("browser-ai-vision");
  });

  it("clamps counts to 0..500 and rounds", () => {
    expect(
      parseEstimate('{"count": -5, "confidence": "low", "description": ""}', "gemini-vision")
        ?.count
    ).toBe(0);
    expect(
      parseEstimate('{"count": 9999, "confidence": "low", "description": ""}', "gemini-vision")
        ?.count
    ).toBe(500);
    expect(
      parseEstimate('{"count": 4.6, "confidence": "low", "description": ""}', "gemini-vision")
        ?.count
    ).toBe(5);
  });

  it("defaults invalid confidence to low and coerces bad counts to 0", () => {
    const result = parseEstimate(
      '{"count": "many", "confidence": "certain", "description": "?"}',
      "gemini-vision"
    );
    expect(result).toMatchObject({ count: 0, confidence: "low" });
  });

  it("returns null when there is no JSON", () => {
    expect(parseEstimate("I cannot analyze this image.", "gemini-vision")).toBeNull();
  });
});

describe("POST /api/ai/vision-report validation", () => {
  const originalKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    delete process.env.GEMINI_API_KEY;
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  });

  function makeRequest(body: unknown) {
    return new Request("http://localhost/api/ai/vision-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as never;
  }

  it("returns 503 when server vision AI is not configured", async () => {
    const res = await POST(makeRequest({ image: "aGVsbG8=" }));
    expect(res.status).toBe(503);
  });

  it("returns 422 when image is missing", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(422);
  });

  it("returns 422 for a non-image mime type", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const res = await POST(makeRequest({ image: "aGVsbG8=", mime_type: "text/html" }));
    expect(res.status).toBe(422);
  });

  it("returns 422 when the payload exceeds the size cap", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const res = await POST(makeRequest({ image: "A".repeat(6_000_001) }));
    expect(res.status).toBe(422);
  });
});

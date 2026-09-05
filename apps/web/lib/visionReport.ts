// Photo → supply estimate ("snap the box").
// Chain: 1) server Gemini vision (/api/ai/vision-report)
//        2) browser built-in multimodal AI (Chrome Prompt API, on-device)
// Both return the same shape so the station page can prefill a supply report.

export interface VisionEstimate {
  count: number;
  confidence: "high" | "medium" | "low";
  description: string;
  provider: "gemini-vision" | "browser-ai-vision";
}

const BROWSER_PROMPT =
  "This is a photo of a community menstrual-product donation box or shelf. " +
  "Count the visible menstrual pads/packages. Respond with ONLY a JSON object: " +
  '{"count": <integer estimate, 0 if empty>, "confidence": "high"|"medium"|"low", ' +
  '"description": "<one short sentence>"} ' +
  "If the photo doesn't show a donation box or menstrual products, use count 0 and confidence \"low\".";

async function fileToBase64(file: Blob): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  return dataUrl.slice(dataUrl.indexOf(",") + 1);
}

/** Downscale to keep uploads small (and under the API's base64 cap). */
async function downscale(file: Blob, maxDim = 1280): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    if (scale === 1) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.85)
    );
  } catch {
    return file;
  }
}

export function parseEstimate(
  text: string,
  provider: VisionEstimate["provider"]
): VisionEstimate | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    return {
      count: Math.max(0, Math.min(500, Math.round(Number(parsed.count) || 0))),
      confidence: ["high", "medium", "low"].includes(parsed.confidence)
        ? parsed.confidence
        : "low",
      description: String(parsed.description ?? "").slice(0, 300),
      provider,
    };
  } catch {
    return null;
  }
}

// ---- Tier 1: server Gemini vision ----

async function serverVision(image: Blob): Promise<VisionEstimate | null> {
  try {
    const scaled = await downscale(image);
    const res = await fetch("/api/ai/vision-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: await fileToBase64(scaled),
        mime_type: scaled.type || "image/jpeg",
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      count: data.count,
      confidence: data.confidence,
      description: data.description,
      provider: "gemini-vision",
    };
  } catch {
    return null;
  }
}

// ---- Tier 2: browser built-in multimodal AI (Chrome Prompt API) ----

interface BrowserMultimodalModel {
  availability?: (opts?: Record<string, unknown>) => Promise<string>;
  create: (opts?: Record<string, unknown>) => Promise<{
    prompt: (
      input: Array<{
        role: string;
        content: Array<{ type: string; value: unknown }>;
      }>
    ) => Promise<string>;
    destroy?: () => void;
  }>;
}

function getBrowserModel(): BrowserMultimodalModel | null {
  const w = window as unknown as {
    LanguageModel?: BrowserMultimodalModel;
    ai?: { languageModel?: BrowserMultimodalModel };
  };
  return w.LanguageModel ?? w.ai?.languageModel ?? null;
}

async function browserVision(image: Blob): Promise<VisionEstimate | null> {
  const model = getBrowserModel();
  if (!model) return null;
  try {
    const opts = { expectedInputs: [{ type: "image" }] };
    if (model.availability) {
      const status = await model.availability(opts);
      if (status !== "available" && status !== "readily") return null;
    }
    const session = await model.create(opts);
    const bitmap = await createImageBitmap(await downscale(image));
    const reply = await session.prompt([
      {
        role: "user",
        content: [
          { type: "text", value: BROWSER_PROMPT },
          { type: "image", value: bitmap },
        ],
      },
    ]);
    session.destroy?.();
    return parseEstimate(reply, "browser-ai-vision");
  } catch {
    return null;
  }
}

/** Analyze a donation-box photo: Gemini vision first, on-device AI as fallback. */
export async function analyzeSupplyPhoto(image: Blob): Promise<VisionEstimate | null> {
  return (await serverVision(image)) ?? (await browserVision(image));
}

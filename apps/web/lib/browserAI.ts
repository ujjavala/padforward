// Client-side assistant fallbacks, used when the network/API is unreachable:
//   1. Browser built-in AI (Chrome's Prompt API / Gemini Nano — works offline)
//   2. Deterministic heuristics over the last stations the app has seen
// The server route (/api/ai/query) remains the primary path (Gemini or the
// server-side deterministic engine).
import type { AIResponse, Station } from "./types";

// ---- Last-known station cache (populated by lib/api.ts) ----

const CACHE_KEY = "padforward.stations";

export function cacheStations(stations: Station[]): void {
  try {
    if (!stations.length) return;
    const existing: Station[] = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "[]");
    const byId = new Map<number, Station>(existing.map((s) => [s.id, s]));
    for (const s of stations) byId.set(s.id, s);
    localStorage.setItem(CACHE_KEY, JSON.stringify([...byId.values()].slice(-50)));
  } catch {
    /* storage unavailable — cache is best-effort */
  }
}

export function cachedStations(): Station[] {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

// ---- Tier 2: browser built-in AI (Chrome Prompt API, on-device) ----

interface BrowserLanguageModel {
  availability?: () => Promise<string>;
  create: (opts?: Record<string, unknown>) => Promise<{
    prompt: (text: string) => Promise<string>;
    destroy?: () => void;
  }>;
}

function getBrowserModel(): BrowserLanguageModel | null {
  const w = window as unknown as { LanguageModel?: BrowserLanguageModel; ai?: { languageModel?: BrowserLanguageModel } };
  return w.LanguageModel ?? w.ai?.languageModel ?? null;
}

export async function browserAIAvailable(): Promise<boolean> {
  const model = getBrowserModel();
  if (!model) return false;
  try {
    const status = model.availability ? await model.availability() : "available";
    return status === "available" || status === "readily";
  } catch {
    return false;
  }
}

export async function browserAIQuery(message: string): Promise<AIResponse | null> {
  const model = getBrowserModel();
  if (!model) return null;
  try {
    const stations = cachedStations();
    const context = stations.length
      ? "Known community supply points (may be stale):\n" +
        stations
          .slice(0, 10)
          .map(
            (s) =>
              `- ${s.name}: ${s.supply_status.replace(/_/g, " ").toLowerCase()}, ` +
              `${s.current_supply} pads reported, need score ${s.need_score}` +
              (s.walking_minutes != null ? `, ${s.walking_minutes} min walk` : "")
          )
          .join("\n")
      : "No cached supply data is available.";
    const session = await model.create({
      initialPrompts: [
        {
          role: "system",
          content:
            "You are the PadForward assistant. You are running OFFLINE in the user's browser. " +
            "Help them find or donate emergency menstrual products using ONLY the supply data below. " +
            "Never invent stations or availability. Be concise, calm and non-judgmental. " +
            "Remind the user the data may be out of date because they are offline.\n\n" +
            context,
        },
      ],
    });
    const reply = await session.prompt(message);
    session.destroy?.();
    return { reply: reply.trim(), intent: null, tool_calls: [], stations: [], provider: "browser-ai" };
  } catch {
    return null;
  }
}

// ---- Tier 3: deterministic heuristics over cached map data ----

export function heuristicQuery(message: string): AIResponse {
  const text = message.toLowerCase();
  const stations = cachedStations();
  const available = stations
    .filter((s) => s.supply_status === "PLENTY" || s.supply_status === "A_FEW")
    .sort((a, b) => (a.walking_minutes ?? 999) - (b.walking_minutes ?? 999));
  const neediest = [...stations].sort((a, b) => b.need_score - a.need_score);

  const offline = " (You appear to be offline — this is based on the last data the app saw.)";

  if (["donate", "donation", "give", "spare"].some((w) => text.includes(w))) {
    if (neediest.length) {
      const top = neediest[0];
      return heuristicResponse(
        `${top.name} had the highest need (score ${top.need_score}, ` +
          `supply: ${top.supply_status.replace(/_/g, " ").toLowerCase()}). ` +
          `Your donation would help most there.${offline}`
      );
    }
    return heuristicResponse(
      `I can't reach the network and have no cached data. Any station donation box will help.${offline}`
    );
  }

  if (
    ["need a pad", "need pad", "period", "pad near", "find a pad", "pad nearby", "tampon"].some(
      (w) => text.includes(w)
    )
  ) {
    if (available.length) {
      const top = available[0];
      const alt = available[1];
      let reply =
        `${top.name} last reported community supply (${top.current_supply} pads` +
        (top.walking_minutes != null ? `, about ${top.walking_minutes} min walk` : "") +
        `).`;
      if (alt) reply += ` If it's out, try ${alt.name}.`;
      return heuristicResponse(reply + offline);
    }
    return heuristicResponse(
      `I can't reach the network right now. Try the Find a pad map for the last known locations.${offline}`
    );
  }

  return heuristicResponse(
    `I'm offline, so I can only help with the basics: finding a pad from the last known map data, ` +
      `or suggesting where to donate. Try asking "I need a pad nearby".${offline}`
  );
}

function heuristicResponse(reply: string): AIResponse {
  return { reply, intent: null, tool_calls: [], stations: [], provider: "offline-heuristics" };
}

/** Full offline chain: browser AI first, heuristics as the last resort. */
export async function offlineQuery(message: string): Promise<AIResponse> {
  if (await browserAIAvailable()) {
    const res = await browserAIQuery(message);
    if (res) return res;
  }
  return heuristicQuery(message);
}

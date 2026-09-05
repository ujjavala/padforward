// AI agent — port of services/api/app/ai/agent.py.
// Gemini function-calling when GEMINI_API_KEY is set; deterministic intent
// engine otherwise. Both paths call the exact same validated tools.
import type { AIResponse, AIToolCall } from "../lib/types";
import { executeTool, TOOL_DECLARATIONS } from "./tools";
import type { Store } from "./store";

const SYSTEM_PROMPT = `You are the PadForward assistant, part of a community network that helps people
find and give emergency menstrual products at public locations — privately, with no need to ask anyone.

Rules:
- Be concise, calm, non-judgmental, and action-oriented. A few short sentences at most.
- For urgent needs, lead with the nearest AVAILABLE location, its walking time, then directions.
- ONLY state supply/availability that comes from tool results. Never invent stations, supplies or donations.
- If a tool returns no data, say: "I don't have a recent supply report for that location."
- Never ask for or reveal personal or menstrual health information. No medical advice.
- Only call create_donation when the user has clearly confirmed a quantity and a station.
- All data in this demo is clearly-labelled demo community data.`;

function makeResponse(
  reply: string,
  intent: string | null,
  toolCalls: AIToolCall[],
  provider = "fallback"
): AIResponse {
  return { reply, intent, tool_calls: toolCalls, stations: [], provider };
}

// ---------- Deterministic fallback agent ----------

function parseRoute(text: string): [string, string] | null {
  for (const [startKw, midKw] of [["from ", " to "], ["between ", " and "]] as const) {
    const start = text.indexOf(startKw);
    if (start === -1) continue;
    const rest = text.slice(start + startKw.length);
    const mid = rest.indexOf(midKw);
    if (mid === -1) continue;
    const origin = rest.slice(0, mid).trim();
    let destPart = rest.slice(mid + midKw.length);
    for (const stopChar of ".?,!") {
      const cut = destPart.indexOf(stopChar);
      if (cut !== -1) destPart = destPart.slice(0, cut);
    }
    const dest = destPart.trim();
    if (origin && dest) return [origin, dest];
  }
  return null;
}

function extractStation(store: Store, text: string): string | null {
  for (const s of store.stations) {
    const name = s.name.toLowerCase();
    const short = name.replace(" station", "").replace(" bus interchange", "");
    if (text.includes(name) || (short.length > 3 && text.includes(short))) return s.name;
  }
  return null;
}

function deterministicProcess(
  store: Store,
  message: string,
  lat?: number,
  lng?: number
): AIResponse {
  const text = message.toLowerCase();
  const calls: AIToolCall[] = [];

  const run = (tool: string, args: Record<string, any>) => {
    calls.push({ tool, args });
    return executeTool(store, tool, args);
  };

  const qtyMatch = text.match(/(\d+)\s*(?:pads?|boxes?)?/);
  const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : null;
  const stationName = extractStation(store, text);

  // Route search
  const route = parseRoute(text);
  if (
    route &&
    ["route", "way", "travelling", "traveling", "detour", "along"].some((w) => text.includes(w))
  ) {
    const result = run("find_locations_along_route", {
      origin_name: route[0],
      dest_name: route[1],
      max_detour_km: 2.0,
    });
    if (result.error) return makeResponse(result.error, "ROUTE_SEARCH", calls);
    const stations = (result.stations ?? []).filter((s: any) =>
      ["PLENTY", "A_FEW"].includes(s.supply_status)
    );
    if (!stations.length)
      return makeResponse(
        "No location along that route currently has reported community supply.",
        "ROUTE_SEARCH",
        calls
      );
    const top = stations[0];
    return makeResponse(
      `${top.name} is roughly a ${top.walking_minutes}-minute detour from your route ` +
        `and has ${top.current_supply} pads reported.`,
      "ROUTE_SEARCH",
      calls
    );
  }

  // Empty / supply report
  if (
    ["empty", "none left", "no pads", "ran out", "out of pads"].some((w) => text.includes(w)) &&
    stationName
  ) {
    const result = run("report_supply_status", { station_name: stationName, reported_supply: 0 });
    if (result.error) return makeResponse(result.error, "SUPPLY_REPORT", calls);
    return makeResponse(
      `Thanks — I've recorded that ${result.station} has no community supply. ` +
        `Its need score is now ${result.need_score}, so donors will see it as a priority.`,
      "SUPPLY_REPORT",
      calls
    );
  }

  // Donation
  if (["donate", "donation", "give", "spare"].some((w) => text.includes(w))) {
    const result = run("get_highest_need_locations", { latitude: lat, longitude: lng, limit: 3 });
    const stations = result.stations ?? [];
    if (!stations.length)
      return makeResponse(
        "I don't have a recent supply report for any nearby location.",
        "DONATE",
        calls
      );
    const top = stations[0];
    const qtyPart = quantity ? `Your ${quantity} pads` : "Your donation";
    return makeResponse(
      `${top.name} is currently the highest-priority location ` +
        `(need score ${top.need_score}, ${top.need_level.toLowerCase()} need, ` +
        `supply: ${top.supply_status.replace(/_/g, " ").toLowerCase()}). ` +
        `${qtyPart} would help most there. Open the Donate flow to confirm.`,
      "DONATE",
      calls
    );
  }

  // Find a pad
  if (
    [
      "need a pad", "need pad", "period", "pad near", "find a pad", "pad nearby",
      "something for my period", "tampon",
    ].some((w) => text.includes(w))
  ) {
    let qLat = lat;
    let qLng = lng;
    if (stationName) {
      const status = run("get_station_status", { station_name: stationName });
      if (status.station) {
        qLat = status.station.latitude;
        qLng = status.station.longitude;
      }
    }
    if (qLat == null || qLng == null) {
      return makeResponse(
        "I can help. Share your location or tell me the nearest station " +
          "(for example: 'I'm at Central') and I'll find the closest community supply.",
        "FIND_PAD",
        calls
      );
    }
    const result = run("find_nearby_stations", { latitude: qLat, longitude: qLng, radius_km: 5.0 });
    const stations = result.stations ?? [];
    const available = stations.filter((s: any) => ["PLENTY", "A_FEW"].includes(s.supply_status));
    if (available.length) {
      const top = available[0];
      const alt = available[1];
      let reply =
        `${top.name} has community supply (${top.current_supply} pads reported), ` +
        `about ${top.walking_minutes} min walk. `;
      if (alt) reply += `If it's out, ${alt.name} is ${alt.walking_minutes} min away.`;
      return makeResponse(reply, "FIND_PAD", calls);
    }
    if (stations.length) {
      return makeResponse(
        `No community supply is currently reported nearby. The closest point is ` +
          `${stations[0].name} (${stations[0].walking_minutes} min walk) — you can ` +
          `report the shortage there so donors are alerted.`,
        "FIND_PAD",
        calls
      );
    }
    return makeResponse(
      "I don't have a recent supply report for any nearby location.",
      "FIND_PAD",
      calls
    );
  }

  if (["impact", "stats", "how many"].some((w) => text.includes(w))) {
    const result = run("get_user_impact", {});
    return makeResponse(
      `The demo network currently has ${result.stations} stations, ` +
        `${result.pads_donated} pads donated and ${result.champions} Pad Champions.`,
      "IMPACT",
      calls
    );
  }

  if (["adopt", "champion"].some((w) => text.includes(w)) && stationName) {
    const result = run("adopt_station", { station_name: stationName });
    if (result.error) return makeResponse(result.error, "ADOPT", calls);
    return makeResponse(
      `You're now a Pad Champion for ${result.station} — it has ` +
        `${result.champion_count} champions. Thank you for keeping it stocked.`,
      "ADOPT",
      calls
    );
  }

  return makeResponse(
    "I can help you find a pad nearby, recommend where to donate, record a supply " +
      "report, or find a location along your route. What do you need?",
    "UNKNOWN",
    calls
  );
}

// ---------- Gemini function-calling agent ----------

const MAX_TOOL_ROUNDS = 4;

async function geminiProcess(
  store: Store,
  message: string,
  lat?: number,
  lng?: number
): Promise<AIResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("no key");
  const { GoogleGenAI } = await import("@google/genai");
  const client = new GoogleGenAI({ apiKey });

  const context =
    lat != null && lng != null
      ? `\n(User's approximate location: latitude ${lat}, longitude ${lng}.)`
      : "";

  const contents: any[] = [{ role: "user", parts: [{ text: message + context }] }];
  const calls: AIToolCall[] = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await client.models.generateContent({
      model: "gemini-2.0-flash",
      contents,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        tools: [{ functionDeclarations: TOOL_DECLARATIONS as any }],
        temperature: 0.2,
      },
    });
    const candidate = response.candidates?.[0];
    const parts: any[] = candidate?.content?.parts ?? [];
    const fnParts = parts.filter((p) => p.functionCall);
    if (!fnParts.length) {
      const text = parts.map((p) => p.text ?? "").join("").trim();
      return makeResponse(
        text || "I'm not sure how to help with that.",
        null,
        calls,
        "gemini"
      );
    }
    contents.push(candidate!.content);
    const responseParts: any[] = [];
    for (const part of fnParts) {
      const name = part.functionCall.name;
      const args = { ...(part.functionCall.args ?? {}) };
      const result = executeTool(store, name, args);
      calls.push({ tool: name, args });
      responseParts.push({ functionResponse: { name, response: { result } } });
    }
    contents.push({ role: "tool", parts: responseParts });
  }

  return makeResponse(
    "I gathered the data but couldn't finish the answer — please try again.",
    null,
    calls,
    "gemini"
  );
}

export async function processUserRequest(
  store: Store,
  message: string,
  lat?: number,
  lng?: number
): Promise<AIResponse> {
  if (process.env.GEMINI_API_KEY) {
    try {
      return await geminiProcess(store, message, lat, lng);
    } catch {
      // Gemini call failed — fall through to the deterministic engine.
    }
  }
  return deterministicProcess(store, message, lat, lng);
}

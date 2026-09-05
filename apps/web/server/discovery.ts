// AI-assisted station discovery — port of services/api/app/services/discovery_service.py
// 1) Live OpenStreetMap Overpass lookup (real stations, no key)
// 2) Gemini (when GEMINI_API_KEY is set)
// 3) Deterministic simulation seeded from coordinates
import { createHash } from "crypto";

import type { StationType } from "../lib/types";
import {
  deriveSupplyStatus,
  recomputeNeedScore,
  type StationRecord,
  type Store,
} from "./store";

interface Candidate {
  name: string;
  type: StationType;
  latitude: number;
  longitude: number;
  address: string;
}

// name suffix, type, bearing (deg), distance (km)
const FALLBACK_SPOTS: [string, StationType, number, number][] = [
  ["Central", "TRAIN_STATION", 40, 0.4],
  ["North", "TRAIN_STATION", 0, 1.1],
  ["South", "BUS_STATION", 180, 0.7],
  ["East Interchange", "BUS_STATION", 95, 1.4],
  ["West", "TRAIN_STATION", 265, 1.8],
];

// supply, estimated demand, verified hours ago — mirrors the Sydney seed mix
const SUPPLY_PROFILES: [number, number, number][] = [
  [10, 18, 1],
  [3, 15, 4],
  [0, 22, 26],
  [6, 12, 7],
  [2, 14, 5],
];

function offset(lat: number, lng: number, bearingDeg: number, distKm: number): [number, number] {
  const dLat = (distKm / 111.32) * Math.cos((bearingDeg * Math.PI) / 180);
  const dLng =
    (distKm / (111.32 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)))) *
    Math.sin((bearingDeg * Math.PI) / 180);
  return [lat + dLat, lng + dLng];
}

async function osmCandidates(lat: number, lng: number, radiusM = 3000): Promise<Candidate[] | null> {
  const query =
    `[out:json][timeout:8];` +
    `(nwr[railway=station](around:${radiusM},${lat},${lng});` +
    `nwr[railway=halt](around:${radiusM},${lat},${lng});)->.trains;` +
    `.trains out center 10;` +
    `(node[highway=bus_stop][name](around:${radiusM},${lat},${lng});` +
    `nwr[amenity=bus_station](around:${radiusM},${lat},${lng});)->.buses;` +
    `.buses out center 15;`;
  try {
    const resp = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: new URLSearchParams({ data: query }),
      headers: { "User-Agent": "PadForward-demo/1.0 (community hackathon project)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return null;
    const elements: any[] = (await resp.json()).elements ?? [];

    const seen = new Set<string>();
    const trains: Candidate[] = [];
    const buses: Candidate[] = [];
    for (const el of elements) {
      const tags = el.tags ?? {};
      const name = tags.name;
      const elLat = el.lat ?? el.center?.lat;
      const elLng = el.lon ?? el.center?.lon;
      if (!name || seen.has(name) || elLat == null || elLng == null) continue;
      seen.add(name);
      const isTrain = tags.railway === "station" || tags.railway === "halt";
      const candidate: Candidate = {
        name: String(name).slice(0, 80),
        type: isTrain ? "TRAIN_STATION" : "BUS_STATION",
        latitude: Number(elLat),
        longitude: Number(elLng),
        address: "Real location via OpenStreetMap — Demo Community Point",
      };
      (isTrain ? trains : buses).push(candidate);
    }
    const dist = (c: Candidate) => (c.latitude - lat) ** 2 + (c.longitude - lng) ** 2;
    trains.sort((a, b) => dist(a) - dist(b));
    buses.sort((a, b) => dist(a) - dist(b));
    const picked = [...trains, ...buses].slice(0, 5);
    return picked.length ? picked : null;
  } catch {
    return null;
  }
}

async function geminiCandidates(lat: number, lng: number): Promise<Candidate[] | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  try {
    const { GoogleGenAI } = await import("@google/genai");
    const client = new GoogleGenAI({ apiKey });
    const prompt =
      `List up to 5 real train or bus stations within 3 km of latitude ${lat}, longitude ${lng}. ` +
      `Respond ONLY with a JSON array of objects with keys: "name" (string), ` +
      `"type" ("TRAIN_STATION" or "BUS_STATION"), "latitude" (number), "longitude" (number), ` +
      `"address" (string, short).`;
    const response = await client.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });
    let text = (response.text ?? "").trim();
    if (text.startsWith("```")) {
      text = text.replace(/^```(?:json)?/, "").replace(/```$/, "").trim();
    }
    const candidates: any[] = JSON.parse(text);
    const cleaned: Candidate[] = [];
    for (const c of candidates.slice(0, 5)) {
      const cLat = Number(c.latitude);
      const cLng = Number(c.longitude);
      // Reject anything implausibly far from the user (hallucination guard)
      if (Math.abs(cLat - lat) > 0.1 || Math.abs(cLng - lng) > 0.1) continue;
      cleaned.push({
        name: String(c.name).slice(0, 80),
        type: c.type === "BUS_STATION" ? "BUS_STATION" : "TRAIN_STATION",
        latitude: cLat,
        longitude: cLng,
        address: `${String(c.address ?? "").slice(0, 120)} — Demo Community Point`,
      });
    }
    return cleaned.length ? cleaned : null;
  } catch {
    return null;
  }
}

/** Mulberry32 PRNG — deterministic per location, like Python's seeded Random. */
function mulberry32(seedNum: number): () => number {
  let a = seedNum;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function simulatedCandidates(lat: number, lng: number): Candidate[] {
  const seedHex = createHash("sha256")
    .update(`${lat.toFixed(3)},${lng.toFixed(3)}`)
    .digest("hex");
  const rng = mulberry32(parseInt(seedHex.slice(0, 8), 16));
  const area = `Area ${seedHex.slice(0, 4).toUpperCase()}`;
  return FALLBACK_SPOTS.map(([suffix, type, bearing, dist]) => {
    const b = bearing + (rng() * 30 - 15);
    const d = dist * (0.8 + rng() * 0.4);
    const [cLat, cLng] = offset(lat, lng, b, d);
    const kind = type === "TRAIN_STATION" ? "Station" : "Bus Stop";
    return {
      name: `${area} ${suffix} ${kind}`,
      type,
      latitude: cLat,
      longitude: cLng,
      address: "Simulated location near you — Demo Community Point",
    };
  });
}

/** Create demo community points around (lat, lng). Returns how many were added. */
export async function discoverStations(store: Store, lat: number, lng: number): Promise<number> {
  const candidates =
    (await osmCandidates(lat, lng)) ??
    (await geminiCandidates(lat, lng)) ??
    simulatedCandidates(lat, lng);
  const now = new Date();
  let created = 0;
  candidates.forEach((candidate, i) => {
    const profile = SUPPLY_PROFILES[i];
    if (!profile) return;
    const [supply, demand, verifiedH] = profile;
    const station: StationRecord = {
      id: store.nextId++,
      name: candidate.name,
      type: candidate.type,
      latitude: candidate.latitude,
      longitude: candidate.longitude,
      address: candidate.address,
      current_supply: supply,
      supply_status: deriveSupplyStatus(supply, true),
      need_score: 0,
      estimated_demand: demand,
      last_verified_at: new Date(now.getTime() - verifiedH * 3_600_000),
      last_restocked_at: new Date(now.getTime() - (verifiedH + 12) * 3_600_000),
    };
    store.stations.push(station);
    store.reports.push({
      id: store.nextId++,
      station_id: station.id,
      reported_supply: supply,
      report_type: "ANONYMOUS",
      confidence: "MEDIUM",
      created_at: station.last_verified_at!,
    });
    const requestCount = supply === 0 ? 6 : supply < 5 ? 2 : 1;
    for (let j = 0; j < requestCount; j++) {
      store.requests.push({
        id: store.nextId++,
        station_id: station.id,
        request_type: "NEED_SEARCH",
        created_at: new Date(now.getTime() - (1 + j * 2) * 3_600_000),
        resolved_at: null,
      });
    }
    recomputeNeedScore(store, station);
    created++;
  });
  return created;
}

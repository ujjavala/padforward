// Validated application tools exposed to the AI agent — port of app/ai/tools.py.
// The model never touches the store directly; every action goes through these.
import type { Station } from "../lib/types";
import { createDonation } from "./donations";
import { haversineKm, walkingMinutes } from "./geo";
import { getImpact } from "./impact";
import {
  adoptStation,
  createSupplyReport,
  findAlongRoute,
  findNearby,
  highestNeed,
  toStationOut,
} from "./stations";
import { recomputeNeedScore, type StationRecord, type Store } from "./store";

function stationDict(s: Station) {
  return {
    id: s.id,
    name: s.name,
    type: s.type,
    supply_status: s.supply_status,
    current_supply: s.current_supply,
    need_score: s.need_score,
    need_level: s.need_level,
    community_confidence: s.community_confidence,
    champion_count: s.champion_count,
    distance_km: s.distance_km,
    walking_minutes: s.walking_minutes,
    last_verified_at: s.last_verified_at,
    latitude: s.latitude,
    longitude: s.longitude,
  };
}

function resolveStation(
  store: Store,
  stationId?: number | null,
  stationName?: string | null
): StationRecord | undefined {
  if (stationId != null) return store.stations.find((s) => s.id === Number(stationId));
  if (stationName) {
    const needle = stationName.toLowerCase().trim();
    return store.stations.find((s) => s.name.toLowerCase().includes(needle));
  }
  return undefined;
}

type ToolFn = (
  store: Store,
  args: Record<string, any>
) => Record<string, any> | Promise<Record<string, any>>;

const tools: Record<string, ToolFn> = {
  find_nearby_stations: (store, { latitude, longitude, radius_km = 5.0 }) => ({
    stations: findNearby(store, latitude, longitude, radius_km).map(stationDict),
  }),

  get_station_status: (store, { station_id, station_name }) => {
    const station = resolveStation(store, station_id, station_name);
    if (!station) return { error: "No matching station found. I don't have data for that location." };
    return { station: stationDict(toStationOut(store, station)) };
  },

  get_station_facilities: (store, { station_id, station_name }) => {
    const station = resolveStation(store, station_id, station_name);
    if (!station) return { error: "No matching station found." };
    return {
      station: station.name,
      type: station.type,
      address: station.address,
      padforward_point: true,
      demo_community_point: true,
    };
  },

  get_walking_route: (store, { origin_lat, origin_lng, station_id, station_name }) => {
    const station = resolveStation(store, station_id, station_name);
    if (!station) return { error: "No matching station found." };
    const dist = haversineKm(origin_lat, origin_lng, station.latitude, station.longitude);
    return {
      station: station.name,
      distance_km: Math.round(dist * 100) / 100,
      walking_minutes: walkingMinutes(dist),
      directions_url:
        `https://www.google.com/maps/dir/?api=1&origin=${origin_lat},${origin_lng}` +
        `&destination=${station.latitude},${station.longitude}&travelmode=walking`,
    };
  },

  calculate_station_need: (store, { station_id, station_name }) => {
    const station = resolveStation(store, station_id, station_name);
    if (!station) return { error: "No matching station found." };
    recomputeNeedScore(store, station);
    const out = toStationOut(store, station);
    return { station: station.name, need_score: out.need_score, need_level: out.need_level };
  },

  get_highest_need_locations: (store, { latitude, longitude, limit = 3 }) => ({
    stations: highestNeed(store, latitude ?? undefined, longitude ?? undefined, Number(limit)).map(
      stationDict
    ),
  }),

  create_donation: async (store, { station_id, station_name, quantity = 1 }) => {
    const station = resolveStation(store, station_id, station_name);
    if (!station) return { error: "No matching station found — donation not recorded." };
    if (quantity <= 0 || quantity > 1000) return { error: "Quantity must be between 1 and 1000." };
    const result = await createDonation(store, station, Number(quantity));
    return {
      donation_id: result.donation.id,
      station: station.name,
      quantity,
      before: result.station_before,
      after: stationDict(result.station_after),
      message: result.message,
    };
  },

  report_supply_status: (store, { reported_supply, station_id, station_name }) => {
    const station = resolveStation(store, station_id, station_name);
    if (!station) return { error: "No matching station found — report not recorded." };
    if (reported_supply < 0 || reported_supply > 500)
      return { error: "Reported supply must be between 0 and 500." };
    const report = createSupplyReport(store, station, Number(reported_supply), "ANONYMOUS");
    return {
      recorded: true,
      station: station.name,
      reported_supply: report.reported_supply,
      new_status: station.supply_status,
      need_score: station.need_score,
    };
  },

  adopt_station: (store, { station_id, station_name }) => {
    const station = resolveStation(store, station_id, station_name);
    if (!station) return { error: "No matching station found." };
    adoptStation(store, station);
    return {
      adopted: true,
      station: station.name,
      champion_count: store.champions.filter((c) => c.station_id === station.id).length,
    };
  },

  get_user_impact: (store) => {
    const impact = getImpact(store);
    return {
      stations: impact.stations,
      donors: impact.donors,
      champions: impact.champions,
      pads_donated: impact.pads_donated,
      requests_fulfilled: impact.requests_fulfilled,
      demo_network: impact.demo_network,
    };
  },

  find_locations_along_route: (store, args) => {
    let { origin_lat, origin_lng, dest_lat, dest_lng } = args;
    const { origin_name, dest_name, max_detour_km = 1.5 } = args;
    if (origin_name && (origin_lat == null || origin_lng == null)) {
      const s = resolveStation(store, null, origin_name);
      if (s) [origin_lat, origin_lng] = [s.latitude, s.longitude];
    }
    if (dest_name && (dest_lat == null || dest_lng == null)) {
      const s = resolveStation(store, null, dest_name);
      if (s) [dest_lat, dest_lng] = [s.latitude, s.longitude];
    }
    if ([origin_lat, origin_lng, dest_lat, dest_lng].some((v) => v == null))
      return { error: "I couldn't resolve both ends of that route." };
    return {
      stations: findAlongRoute(
        store,
        [origin_lat, origin_lng],
        [dest_lat, dest_lng],
        max_detour_km
      ).map(stationDict),
    };
  },
};

// Gemini function declarations — same schemas as the Python registry.
export const TOOL_DECLARATIONS = [
  {
    name: "find_nearby_stations",
    description: "Find PadForward community supply points near a latitude/longitude.",
    parameters: {
      type: "object",
      properties: {
        latitude: { type: "number" },
        longitude: { type: "number" },
        radius_km: { type: "number" },
      },
      required: ["latitude", "longitude"],
    },
  },
  {
    name: "get_station_status",
    description:
      "Get current community supply status, need score and confidence for a station by id or name.",
    parameters: {
      type: "object",
      properties: { station_id: { type: "integer" }, station_name: { type: "string" } },
    },
  },
  {
    name: "get_station_facilities",
    description: "Get facility information for a station.",
    parameters: {
      type: "object",
      properties: { station_id: { type: "integer" }, station_name: { type: "string" } },
    },
  },
  {
    name: "get_walking_route",
    description: "Get walking distance, time and a directions link from an origin to a station.",
    parameters: {
      type: "object",
      properties: {
        origin_lat: { type: "number" },
        origin_lng: { type: "number" },
        station_id: { type: "integer" },
        station_name: { type: "string" },
      },
      required: ["origin_lat", "origin_lng"],
    },
  },
  {
    name: "calculate_station_need",
    description: "Recompute and return the need score for a station.",
    parameters: {
      type: "object",
      properties: { station_id: { type: "integer" }, station_name: { type: "string" } },
    },
  },
  {
    name: "get_highest_need_locations",
    description: "Get the stations with the highest need scores (best donation targets).",
    parameters: {
      type: "object",
      properties: {
        latitude: { type: "number" },
        longitude: { type: "number" },
        limit: { type: "integer" },
      },
    },
  },
  {
    name: "create_donation",
    description:
      "Record a confirmed pad donation to a station. Only call after the user confirms quantity and station.",
    parameters: {
      type: "object",
      properties: {
        station_id: { type: "integer" },
        station_name: { type: "string" },
        quantity: { type: "integer" },
      },
      required: ["quantity"],
    },
  },
  {
    name: "report_supply_status",
    description: "Record a community supply report for a station (e.g. it's empty).",
    parameters: {
      type: "object",
      properties: {
        reported_supply: { type: "integer" },
        station_id: { type: "integer" },
        station_name: { type: "string" },
      },
      required: ["reported_supply"],
    },
  },
  {
    name: "adopt_station",
    description: "Adopt a station as a Pad Champion.",
    parameters: {
      type: "object",
      properties: { station_id: { type: "integer" }, station_name: { type: "string" } },
    },
  },
  {
    name: "get_user_impact",
    description: "Get network-wide impact statistics.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "find_locations_along_route",
    description: "Find supply points along a route between two places or stations.",
    parameters: {
      type: "object",
      properties: {
        origin_lat: { type: "number" },
        origin_lng: { type: "number" },
        dest_lat: { type: "number" },
        dest_lng: { type: "number" },
        origin_name: { type: "string" },
        dest_name: { type: "string" },
        max_detour_km: { type: "number" },
      },
    },
  },
];

export async function executeTool(store: Store, name: string, args: Record<string, any>) {
  const fn = tools[name];
  if (!fn) return { error: `Unknown tool: ${name}` };
  try {
    return await fn(store, args);
  } catch {
    return { error: "Tool execution failed." };
  }
}

/** Sync executor for the deterministic engine (which only uses sync tools). */
export function executeToolSync(store: Store, name: string, args: Record<string, any>) {
  const fn = tools[name];
  if (!fn) return { error: `Unknown tool: ${name}` };
  try {
    const result = fn(store, args);
    if (result instanceof Promise) return { error: "This action requires the async agent." };
    return result;
  } catch {
    return { error: "Tool execution failed." };
  }
}

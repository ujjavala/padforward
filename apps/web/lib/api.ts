import type {
  AIResponse,
  DonationResult,
  HealthInfo,
  Impact,
  PaymentMethod,
  SolQuote,
  Station,
} from "./types";
import { cacheStations } from "./browserAI";

// The API is served by Next.js route handlers under /api (same origin).
// NEXT_PUBLIC_API_URL can still point at the standalone FastAPI service
// (see services/api + docs/architecture.md) for the full-stack setup.
// `||` (not ??) so an empty env var also falls back to /api.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`API error ${res.status}: ${detail}`);
  }
  return res.json() as Promise<T>;
}

// Cache station lists so the assistant can still help when offline
// (browser built-in AI / heuristics fallbacks in browserAI.ts).
async function stationsRequest(path: string): Promise<Station[]> {
  const stations = await request<Station[]>(path);
  if (typeof window !== "undefined") cacheStations(stations);
  return stations;
}

export const api = {
  health: () => request<HealthInfo>("/health"),

  nearbyStations: (lat: number, lng: number, radiusKm = 8) =>
    stationsRequest(
      `/stations/nearby?latitude=${lat}&longitude=${lng}&radius_km=${radiusKm}`
    ),

  priorityStations: (lat?: number, lng?: number, limit = 5) => {
    const loc =
      lat !== undefined && lng !== undefined ? `&latitude=${lat}&longitude=${lng}` : "";
    return stationsRequest(`/stations/priority?limit=${limit}${loc}`);
  },

  station: (id: number) => request<Station>(`/stations/${id}`),

  alongRoute: (
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
    maxDetourKm = 2
  ) =>
    stationsRequest(
      `/stations/along-route?origin_lat=${originLat}&origin_lng=${originLng}` +
        `&dest_lat=${destLat}&dest_lng=${destLng}&max_detour_km=${maxDetourKm}`
    ),

  reportSupply: (stationId: number, reportedSupply: number | null, reportType = "ANONYMOUS") =>
    request(`/stations/${stationId}/supply-report`, {
      method: "POST",
      body: JSON.stringify({ reported_supply: reportedSupply, report_type: reportType }),
    }),

  claimPad: (stationId: number, remainingSupply?: number) =>
    request<Station>(`/stations/${stationId}/claim`, {
      method: "POST",
      body: JSON.stringify(
        remainingSupply === undefined ? {} : { remaining_supply: remainingSupply }
      ),
    }),

  adoptStation: (stationId: number) =>
    request<Station>(`/stations/${stationId}/adopt`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  createDonation: (
    stationId: number,
    quantity: number,
    paymentMethod: PaymentMethod = "IN_PERSON",
    walletAddress?: string
  ) =>
    request<DonationResult>("/donations", {
      method: "POST",
      body: JSON.stringify({
        station_id: stationId,
        quantity,
        payment_method: paymentMethod,
        wallet_address: walletAddress,
      }),
    }),

  solQuote: (quantity: number) =>
    request<SolQuote>(`/donations/sol-quote?quantity=${quantity}`),

  impact: () => request<Impact>("/impact"),

  aiQuery: (message: string, latitude?: number, longitude?: number) =>
    request<AIResponse>("/ai/query", {
      method: "POST",
      body: JSON.stringify({ message, latitude, longitude }),
    }),
};

export function directionsUrl(station: Station, origin?: { lat: number; lng: number }) {
  const base = "https://www.google.com/maps/dir/?api=1";
  const dest = `&destination=${station.latitude},${station.longitude}&travelmode=walking`;
  const from = origin ? `&origin=${origin.lat},${origin.lng}` : "";
  return `${base}${from}${dest}`;
}

// In-memory demo data store — replaces the SQLite/Postgres layer for the
// frontend-only hackathon deployment. The designed architecture keeps this
// behind the same API contract (see docs/architecture.md); swapping back to
// the FastAPI + Postgres service requires no frontend changes.
//
// State lives per serverless instance: it survives warm invocations and
// re-seeds deterministically on cold start — same demo semantics as the
// original ephemeral SQLite seed.

import type { StationType, SupplyStatus } from "../lib/types";
import { computeNeedScore, type NeedInputs } from "./needScore";

export type ReporterType = "ANONYMOUS" | "DONOR" | "CHAMPION";
export type Confidence = "LOW" | "MEDIUM" | "HIGH";
export type RequestType = "NEED_SEARCH" | "PAD_CLAIMED";
export type PaymentMethod = "IN_PERSON" | "SOL";

export interface StationRecord {
  id: number;
  name: string;
  type: StationType;
  latitude: number;
  longitude: number;
  address: string;
  current_supply: number;
  supply_status: SupplyStatus;
  need_score: number;
  estimated_demand: number;
  last_verified_at: Date | null;
  last_restocked_at: Date | null;
}

export interface SupplyReportRecord {
  id: number;
  station_id: number;
  reported_supply: number | null;
  report_type: ReporterType;
  confidence: Confidence;
  created_at: Date;
}

export interface RequestRecord {
  id: number;
  station_id: number;
  request_type: RequestType;
  created_at: Date;
  resolved_at: Date | null;
}

export interface DonationRecord {
  id: number;
  station_id: number;
  quantity: number;
  status: "PLEDGED" | "DELIVERED" | "VERIFIED";
  payment_method: PaymentMethod;
  sol_amount: number | null;
  tx_signature: string | null;
  created_at: Date;
}

export interface ChampionRecord {
  id: number;
  station_id: number;
  created_at: Date;
}

export interface Store {
  stations: StationRecord[];
  reports: SupplyReportRecord[];
  requests: RequestRecord[];
  donations: DonationRecord[];
  champions: ChampionRecord[];
  donors: number;
  nextId: number;
}

export function deriveSupplyStatus(currentSupply: number, hasReports: boolean): SupplyStatus {
  if (!hasReports) return "UNKNOWN";
  if (currentSupply <= 0) return "NONE";
  if (currentSupply < 10) return "A_FEW";
  return "PLENTY";
}

export function recentRequests24h(store: Store, stationId: number): number {
  const cutoff = Date.now() - 24 * 3_600_000;
  return store.requests.filter(
    (r) => r.station_id === stationId && r.created_at.getTime() >= cutoff
  ).length;
}

export function recomputeNeedScore(store: Store, station: StationRecord): void {
  const inputs: NeedInputs = {
    current_supply: station.current_supply,
    estimated_demand: station.estimated_demand,
    last_verified_at: station.last_verified_at,
    recent_requests_24h: recentRequests24h(store, station.id),
    historical_daily_demand: station.estimated_demand,
  };
  station.need_score = computeNeedScore(inputs);
}

// name, type, lat, lng, address, supply, est_demand, verified_hours_ago, restocked_hours_ago
const DEMO_STATIONS: [string, StationType, number, number, string, number, number, number, number][] = [
  ["Central Station", "TRAIN_STATION", -33.8832, 151.207,
    "Eddy Ave, Haymarket NSW — Demo Community Point", 12, 22, 0.25, 6],
  ["Town Hall Station", "TRAIN_STATION", -33.8734, 151.207,
    "George St, Sydney NSW — Demo Community Point", 3, 18, 2, 30],
  ["Wynyard Station", "TRAIN_STATION", -33.8656, 151.2058,
    "York St, Sydney NSW — Demo Community Point", 8, 15, 5, 48],
  ["Museum Station", "TRAIN_STATION", -33.8748, 151.2127,
    "Liverpool St, Sydney NSW — Demo Community Point", 0, 26, 30, 96],
  ["Redfern Station", "TRAIN_STATION", -33.8932, 151.1985,
    "Lawson St, Redfern NSW — Demo Community Point", 5, 12, 8, 60],
  ["Central Bus Interchange", "BUS_STATION", -33.8822, 151.2045,
    "Railway Square, Haymarket NSW — Demo Community Point", 2, 14, 4, 40],
];

function hoursAgo(now: Date, h: number): Date {
  return new Date(now.getTime() - h * 3_600_000);
}

function seed(store: Store): void {
  const now = new Date();
  store.donors = 1;
  for (const [name, type, lat, lng, address, supply, demand, verifiedH, restockedH] of DEMO_STATIONS) {
    const station: StationRecord = {
      id: store.nextId++,
      name,
      type,
      latitude: lat,
      longitude: lng,
      address,
      current_supply: supply,
      supply_status: deriveSupplyStatus(supply, true),
      need_score: 0,
      estimated_demand: demand,
      last_verified_at: hoursAgo(now, verifiedH),
      last_restocked_at: hoursAgo(now, restockedH),
    };
    store.stations.push(station);

    const isMuseum = name === "Museum Station";
    store.reports.push({
      id: store.nextId++,
      station_id: station.id,
      reported_supply: supply,
      report_type: isMuseum ? "ANONYMOUS" : "CHAMPION",
      confidence: isMuseum ? "LOW" : "HIGH",
      created_at: hoursAgo(now, verifiedH),
    });
    store.donations.push({
      id: store.nextId++,
      station_id: station.id,
      quantity: Math.max(supply, 5),
      status: "VERIFIED",
      payment_method: "IN_PERSON",
      sol_amount: null,
      tx_signature: null,
      created_at: hoursAgo(now, restockedH),
    });
    if (!isMuseum) {
      store.champions.push({ id: store.nextId++, station_id: station.id, created_at: hoursAgo(now, 72) });
    }

    // Recent request pressure mirrors the Python seed: empty stations get more.
    const requestCount = supply === 0 ? 6 : supply < 5 ? 2 : 1;
    for (let i = 0; i < requestCount; i++) {
      store.requests.push({
        id: store.nextId++,
        station_id: station.id,
        request_type: "NEED_SEARCH",
        created_at: hoursAgo(now, 1 + i * 2),
        resolved_at: null,
      });
    }
    recomputeNeedScore(store, station);
  }
}

// Survive HMR in dev and warm serverless invocations in prod.
const globalStore = globalThis as unknown as { __padforwardStore?: Store };

export function getStore(): Store {
  if (!globalStore.__padforwardStore) {
    const store: Store = {
      stations: [],
      reports: [],
      requests: [],
      donations: [],
      champions: [],
      donors: 0,
      nextId: 1,
    };
    seed(store);
    globalStore.__padforwardStore = store;
  }
  return globalStore.__padforwardStore;
}

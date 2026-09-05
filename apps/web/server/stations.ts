// Station domain logic — port of services/api/app/services/station_service.py
import type { Station } from "../lib/types";
import { haversineKm, pointToSegmentKm, walkingMinutes } from "./geo";
import { classifyNeed } from "./needScore";
import {
  deriveSupplyStatus,
  getStore,
  recomputeNeedScore,
  type ReporterType,
  type StationRecord,
  type Store,
  type SupplyReportRecord,
} from "./store";

export function communityConfidence(store: Store, station: StationRecord): "LOW" | "MEDIUM" | "HIGH" {
  const cutoff = Date.now() - 24 * 3_600_000;
  const reports = store.reports
    .filter((r) => r.station_id === station.id && r.created_at.getTime() >= cutoff)
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    .slice(0, 10);
  if (reports.length === 0) return "LOW";
  let base: "LOW" | "MEDIUM" | "HIGH";
  if (reports.some((r) => r.report_type === "CHAMPION")) base = "HIGH";
  else if (reports.length >= 3) base = "HIGH";
  else if (reports.length === 2) base = "MEDIUM";
  else base = "LOW";
  const values = reports
    .slice(0, 5)
    .map((r) => r.reported_supply)
    .filter((v): v is number => v !== null);
  if (values.length >= 2) {
    const max = Math.max(...values);
    const min = Math.min(...values);
    if (max - min > Math.max(10, max * 0.8)) return base === "HIGH" ? "MEDIUM" : "LOW";
  }
  return base;
}

export function toStationOut(
  store: Store,
  station: StationRecord,
  origin?: [number, number]
): Station {
  const championCount = store.champions.filter((c) => c.station_id === station.id).length;
  const out: Station = {
    id: station.id,
    name: station.name,
    type: station.type,
    latitude: station.latitude,
    longitude: station.longitude,
    address: station.address,
    current_supply: station.current_supply,
    supply_status: station.supply_status,
    need_score: station.need_score,
    need_level: classifyNeed(station.need_score),
    estimated_demand: station.estimated_demand,
    last_verified_at: station.last_verified_at?.toISOString() ?? null,
    last_restocked_at: station.last_restocked_at?.toISOString() ?? null,
    community_confidence: communityConfidence(store, station),
    champion_count: championCount,
    distance_km: null,
    walking_minutes: null,
  };
  if (origin) {
    const dist = haversineKm(origin[0], origin[1], station.latitude, station.longitude);
    out.distance_km = Math.round(dist * 100) / 100;
    out.walking_minutes = walkingMinutes(dist);
  }
  return out;
}

export function getStation(store: Store, id: number): StationRecord | undefined {
  return store.stations.find((s) => s.id === id);
}

export function findNearby(
  store: Store,
  latitude: number,
  longitude: number,
  radiusKm = 5,
  limit = 10
): Station[] {
  return store.stations
    .map((s) => ({ dist: haversineKm(latitude, longitude, s.latitude, s.longitude), s }))
    .filter(({ dist }) => dist <= radiusKm)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, limit)
    .map(({ s }) => toStationOut(store, s, [latitude, longitude]));
}

export function highestNeed(
  store: Store,
  latitude?: number,
  longitude?: number,
  limit = 5,
  radiusKm?: number
): Station[] {
  const origin: [number, number] | undefined =
    latitude !== undefined && longitude !== undefined ? [latitude, longitude] : undefined;
  if (origin && radiusKm !== undefined) {
    return store.stations
      .filter((s) => haversineKm(origin[0], origin[1], s.latitude, s.longitude) <= radiusKm)
      .sort((a, b) => b.need_score - a.need_score)
      .slice(0, limit)
      .map((s) => toStationOut(store, s, origin));
  }
  return [...store.stations]
    .sort((a, b) => b.need_score - a.need_score)
    .slice(0, limit)
    .map((s) => toStationOut(store, s, origin));
}

export function findAlongRoute(
  store: Store,
  origin: [number, number],
  dest: [number, number],
  maxDetourKm = 1.5
): Station[] {
  return store.stations
    .map((s) => ({
      detour: pointToSegmentKm(s.latitude, s.longitude, origin[0], origin[1], dest[0], dest[1]),
      s,
    }))
    .filter(({ detour }) => detour <= maxDetourKm)
    .sort((a, b) => a.detour - b.detour)
    .map(({ detour, s }) => {
      const out = toStationOut(store, s, origin);
      out.distance_km = Math.round(detour * 100) / 100;
      out.walking_minutes = walkingMinutes(detour);
      return out;
    });
}

export function recordClaim(
  store: Store,
  station: StationRecord,
  remainingSupply: number | null
): StationRecord {
  const now = new Date();
  store.requests.push({
    id: store.nextId++,
    station_id: station.id,
    request_type: "PAD_CLAIMED",
    created_at: now,
    resolved_at: now,
  });
  if (remainingSupply !== null) {
    station.current_supply = remainingSupply;
    station.last_verified_at = now;
  } else {
    station.current_supply = Math.max(0, station.current_supply - 1);
  }
  station.supply_status = deriveSupplyStatus(station.current_supply, true);
  recomputeNeedScore(store, station);
  return station;
}

const BASE_CONFIDENCE: Record<ReporterType, "LOW" | "MEDIUM" | "HIGH"> = {
  ANONYMOUS: "LOW",
  DONOR: "MEDIUM",
  CHAMPION: "HIGH",
};

export function createSupplyReport(
  store: Store,
  station: StationRecord,
  reportedSupply: number | null,
  reportType: ReporterType
): SupplyReportRecord {
  const report: SupplyReportRecord = {
    id: store.nextId++,
    station_id: station.id,
    reported_supply: reportedSupply,
    report_type: reportType,
    confidence: reportedSupply === null ? "LOW" : BASE_CONFIDENCE[reportType],
    created_at: new Date(),
  };
  store.reports.push(report);

  if (reportedSupply === null) {
    station.supply_status = "UNKNOWN";
  } else {
    station.current_supply = reportedSupply;
    station.supply_status = deriveSupplyStatus(reportedSupply, true);
  }
  station.last_verified_at = new Date();
  recomputeNeedScore(store, station);
  return report;
}

export function adoptStation(store: Store, station: StationRecord): void {
  store.champions.push({ id: store.nextId++, station_id: station.id, created_at: new Date() });
}

export { getStore };

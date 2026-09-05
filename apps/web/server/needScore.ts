// Deterministic Need Score engine — direct port of services/api/app/scoring/need_score.py
//
// Need Score (0-100) =
//     40% supply shortage
//   + 20% estimated demand
//   + 15% time since verification
//   + 15% recent requests
//   + 10% historical demand

export const WEIGHTS = {
  supply_shortage: 0.4,
  estimated_demand: 0.2,
  staleness: 0.15,
  recent_requests: 0.15,
  historical_demand: 0.1,
};

const DEMAND_CAP = 30; // pads/day considered "very high demand"
const STALENESS_CAP_HOURS = 48; // unverified for 48h => fully stale
const RECENT_REQUESTS_CAP = 10; // 10+ requests in 24h => maximum pressure

export interface NeedInputs {
  current_supply: number;
  estimated_demand: number;
  last_verified_at: Date | null;
  recent_requests_24h: number;
  historical_daily_demand: number;
  now?: Date;
}

function clamp(value: number, low = 0, high = 100): number {
  return Math.max(low, Math.min(high, value));
}

export function supplyShortageComponent(currentSupply: number, estimatedDemand: number): number {
  const demand = Math.max(estimatedDemand, 1);
  return clamp((1 - currentSupply / demand) * 100);
}

export function demandComponent(estimatedDemand: number): number {
  return clamp((estimatedDemand / DEMAND_CAP) * 100);
}

export function stalenessComponent(lastVerifiedAt: Date | null, now: Date): number {
  if (lastVerifiedAt === null) return 100;
  const hours = (now.getTime() - lastVerifiedAt.getTime()) / 3_600_000;
  return clamp((hours / STALENESS_CAP_HOURS) * 100);
}

export function recentRequestsComponent(recentRequests24h: number): number {
  return clamp((recentRequests24h / RECENT_REQUESTS_CAP) * 100);
}

export function historicalComponent(historicalDailyDemand: number): number {
  return clamp((historicalDailyDemand / DEMAND_CAP) * 100);
}

export function computeNeedScore(inputs: NeedInputs): number {
  const now = inputs.now ?? new Date();
  const score =
    WEIGHTS.supply_shortage *
      supplyShortageComponent(inputs.current_supply, inputs.estimated_demand) +
    WEIGHTS.estimated_demand * demandComponent(inputs.estimated_demand) +
    WEIGHTS.staleness * stalenessComponent(inputs.last_verified_at, now) +
    WEIGHTS.recent_requests * recentRequestsComponent(inputs.recent_requests_24h) +
    WEIGHTS.historical_demand * historicalComponent(inputs.historical_daily_demand);
  return Math.round(clamp(score));
}

export function classifyNeed(score: number): "LOW" | "MODERATE" | "HIGH" | "CRITICAL" {
  if (score <= 30) return "LOW";
  if (score <= 60) return "MODERATE";
  if (score <= 80) return "HIGH";
  return "CRITICAL";
}

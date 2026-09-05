export type SupplyStatus = "PLENTY" | "A_FEW" | "NONE" | "UNKNOWN";
export type NeedLevel = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
export type StationType = "TRAIN_STATION" | "BUS_STATION" | "COMMUNITY_POINT";

export interface Station {
  id: number;
  name: string;
  type: StationType;
  latitude: number;
  longitude: number;
  address: string;
  current_supply: number;
  supply_status: SupplyStatus;
  need_score: number;
  need_level: NeedLevel;
  estimated_demand: number;
  last_verified_at: string | null;
  last_restocked_at: string | null;
  community_confidence: "LOW" | "MEDIUM" | "HIGH";
  champion_count: number;
  distance_km: number | null;
  walking_minutes: number | null;
}

export type PaymentMethod = "IN_PERSON" | "SOL";

export interface SolQuote {
  quantity: number;
  sol_amount: number;
  sol_price_usd: number;
  pad_price_usd: number;
  network: string;
  demo: boolean;
}

export interface DonationResult {
  donation: {
    id: number;
    station_id: number;
    quantity: number;
    status: string;
    payment_method: PaymentMethod;
    sol_amount: number | null;
    tx_signature: string | null;
  };
  station_before: {
    supply_status: SupplyStatus;
    need_score: number;
    need_level: NeedLevel;
    current_supply: number;
  };
  station_after: Station;
  message: string;
}

export interface Impact {
  stations: number;
  donors: number;
  champions: number;
  pads_donated: number;
  donations: number;
  restocks: number;
  requests_fulfilled: number;
  today_pads_donated: number;
  today_supply_reports: number;
  today_restocks: number;
  urgent_stations: Station[];
  demo_network: boolean;
}

export interface AIToolCall {
  tool: string;
  args: Record<string, unknown>;
}

export interface AIResponse {
  reply: string;
  intent: string | null;
  tool_calls: AIToolCall[];
  stations: Station[];
  provider: string;
}

export interface HealthInfo {
  status: string;
  demo_mode: boolean;
  features: { gemini: boolean; google_maps: boolean; snowflake: boolean };
}

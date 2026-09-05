// Community impact aggregates — port of services/api/app/services/impact_service.py
import type { Impact } from "../lib/types";
import { highestNeed } from "./stations";
import type { Store } from "./store";

export function getImpact(store: Store): Impact {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const t = todayStart.getTime();

  const padsDonated = store.donations.reduce((sum, d) => sum + d.quantity, 0);
  const todayDonations = store.donations.filter((d) => d.created_at.getTime() >= t);

  return {
    stations: store.stations.length,
    donors: store.donors,
    champions: store.champions.length,
    pads_donated: padsDonated,
    donations: store.donations.length,
    restocks: store.stations.filter((s) => s.last_restocked_at !== null).length,
    requests_fulfilled: store.requests.filter(
      (r) => r.request_type === "PAD_CLAIMED" && r.resolved_at !== null
    ).length,
    today_pads_donated: todayDonations.reduce((sum, d) => sum + d.quantity, 0),
    today_supply_reports: store.reports.filter((r) => r.created_at.getTime() >= t).length,
    today_restocks: todayDonations.length,
    urgent_stations: highestNeed(store, undefined, undefined, 3).filter((s) => s.need_score > 60),
    demo_network: true,
  };
}

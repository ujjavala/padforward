import Link from "next/link";
import { SUPPLY_META, timeAgo } from "@/lib/display";
import type { Station } from "@/lib/types";
import { NeedBadge, SupplyBadge } from "./Badges";

export function StationCard({
  station,
  href,
  onSelect,
  showNeed = false,
}: Readonly<{
  station: Station;
  href?: string;
  onSelect?: (station: Station) => void;
  showNeed?: boolean;
}>) {
  const meta = SUPPLY_META[station.supply_status];
  const body = (
    <div className="card flex items-start justify-between gap-3 text-left transition hover:shadow-lg">
      <div className="min-w-0">
        <h3 className="truncate font-semibold">{station.name}</h3>
        <p className={`mt-0.5 flex items-center gap-1 text-sm ${meta.text}`}>
          <meta.Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span>
            {meta.label}
            {station.supply_status !== "UNKNOWN" && (
              <> · {station.current_supply} pads reported</>
            )}
          </span>
        </p>
        <p className="mt-0.5 text-xs text-ink-500">
          Verified {timeAgo(station.last_verified_at)} · Confidence:{" "}
          {station.community_confidence.toLowerCase()}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <SupplyBadge status={station.supply_status} />
          {showNeed && <NeedBadge level={station.need_level} score={station.need_score} />}
        </div>
      </div>
      {station.walking_minutes !== null && (
        <div className="shrink-0 text-right">
          <p className="text-lg font-bold text-teal-650">{station.walking_minutes} min</p>
          <p className="text-xs text-ink-500">walk · {station.distance_km} km</p>
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300"
        aria-label={`${station.name}: ${meta.label}${
          station.walking_minutes ? `, ${station.walking_minutes} minute walk` : ""
        }`}
      >
        {body}
      </Link>
    );
  }
  if (onSelect) {
    return (
      <button
        type="button"
        onClick={() => onSelect(station)}
        className="block w-full focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300"
        aria-label={`Select ${station.name}: ${meta.label}`}
      >
        {body}
      </button>
    );
  }
  return body;
}

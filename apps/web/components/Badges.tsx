import { NEED_META, SUPPLY_META } from "@/lib/display";
import type { NeedLevel, SupplyStatus } from "@/lib/types";

export function SupplyBadge({ status }: Readonly<{ status: SupplyStatus }>) {
  const meta = SUPPLY_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${meta.badge}`}
    >
      <meta.Icon aria-hidden="true" className="h-3.5 w-3.5" />
      {meta.label}
    </span>
  );
}

export function NeedBadge({ level, score }: Readonly<{ level: NeedLevel; score?: number }>) {
  const meta = NEED_META[level];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.badge}`}
    >
      {meta.label}
      {score !== undefined ? ` · ${score}` : ""}
    </span>
  );
}

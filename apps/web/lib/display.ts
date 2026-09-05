import type { LucideIcon } from "lucide-react";
import { CircleAlert, CircleCheck, CircleHelp, CircleX } from "lucide-react";
import type { NeedLevel, SupplyStatus } from "./types";

export const SUPPLY_META: Record<
  SupplyStatus,
  { Icon: LucideIcon; label: string; text: string; badge: string; dot: string }
> = {
  PLENTY: {
    Icon: CircleCheck,
    label: "Available",
    text: "text-emerald-800",
    badge: "bg-emerald-100 text-emerald-900 border-emerald-300",
    dot: "bg-emerald-500",
  },
  A_FEW: {
    Icon: CircleAlert,
    label: "Low",
    text: "text-amber-800",
    badge: "bg-amber-100 text-amber-900 border-amber-300",
    dot: "bg-amber-500",
  },
  NONE: {
    Icon: CircleX,
    label: "None reported",
    text: "text-rose-800",
    badge: "bg-rose-100 text-rose-900 border-rose-300",
    dot: "bg-rose-500",
  },
  UNKNOWN: {
    Icon: CircleHelp,
    label: "Unknown",
    text: "text-ink-500",
    badge: "bg-slate-100 text-slate-700 border-slate-300",
    dot: "bg-slate-400",
  },
};

export const NEED_META: Record<NeedLevel, { label: string; badge: string }> = {
  LOW: { label: "Low need", badge: "bg-emerald-100 text-emerald-900" },
  MODERATE: { label: "Moderate need", badge: "bg-sky-100 text-sky-900" },
  HIGH: { label: "High need", badge: "bg-amber-100 text-amber-900" },
  CRITICAL: { label: "Critical need", badge: "bg-rose-100 text-rose-900" },
};

export function timeAgo(iso: string | null): string {
  if (!iso) return "never verified";
  const then = new Date(iso).getTime();
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

export function isStale(iso: string | null, hours = 4): boolean {
  if (!iso) return true;
  return Date.now() - new Date(iso).getTime() > hours * 3600 * 1000;
}

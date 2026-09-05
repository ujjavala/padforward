"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { NeedBadge, SupplyBadge } from "@/components/Badges";
import { api, directionsUrl } from "@/lib/api";
import { timeAgo } from "@/lib/display";
import type { Station } from "@/lib/types";

const REPORT_OPTIONS = [
  { label: "Plenty", value: 15, dot: "bg-emerald-500" },
  { label: "A few", value: 4, dot: "bg-amber-500" },
  { label: "None", value: 0, dot: "bg-rose-500" },
  { label: "Not sure", value: null, dot: "bg-slate-400" },
] as const;

export default function StationDetailPage() {
  const params = useParams<{ id: string }>();
  const stationId = Number(params.id);
  const [station, setStation] = useState<Station | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setStation(await api.station(stationId));
    } catch {
      setError("Station not found.");
    }
  }, [stationId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <div className="card mt-8 text-center">
        <p>{error}</p>
        <Link href="/find" className="mt-2 inline-block text-teal-650 underline">
          Find nearby stations
        </Link>
      </div>
    );
  }
  if (!station) return <p className="pt-8 text-center text-ink-500">Loading…</p>;

  async function report(value: number | null, asChampion = false) {
    setBusy(true);
    setNotice(null);
    try {
      if (asChampion) {
        await api.reportSupply(station!.id, value, "CHAMPION");
      } else {
        await api.reportSupply(station!.id, value);
      }
      setNotice("Thanks — your report helps the next person.");
      await load();
    } catch {
      setNotice("Couldn't record the report. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function adopt() {
    setBusy(true);
    setNotice(null);
    try {
      const updated = await api.adoptStation(station!.id);
      setStation(updated);
      setNotice(`You're now a Pad Champion for ${updated.name}.`);
    } catch {
      setNotice("Couldn't adopt the station. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="card">
        <p className="text-xs font-semibold uppercase tracking-wide text-plum-600">
          Demo community point
        </p>
        <h1 className="mt-1 text-2xl font-bold">{station.name}</h1>
        <p className="text-sm text-ink-500">{station.address}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <SupplyBadge status={station.supply_status} />
          <NeedBadge level={station.need_level} score={station.need_score} />
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-ink-500">Pads reported</dt>
          <dd className="font-semibold">{station.current_supply}</dd>
          <dt className="text-ink-500">Last verified</dt>
          <dd className="font-semibold">{timeAgo(station.last_verified_at)}</dd>
          <dt className="text-ink-500">Last restocked</dt>
          <dd className="font-semibold">{timeAgo(station.last_restocked_at)}</dd>
          <dt className="text-ink-500">Community confidence</dt>
          <dd className="font-semibold capitalize">{station.community_confidence.toLowerCase()}</dd>
          <dt className="text-ink-500">Community champions</dt>
          <dd className="font-semibold">{station.champion_count}</dd>
        </dl>
      </div>

      <a
        href={directionsUrl(station)}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-secondary"
      >
        Get directions
      </a>

      <div className="card">
        <h2 className="font-semibold">Report current supply</h2>
        <p className="mt-1 text-sm text-ink-500">
          Are pads available here right now? Anonymous, one tap.
        </p>
        <fieldset className="mt-3 grid grid-cols-2 gap-2 border-0 sm:grid-cols-4">
          <legend className="sr-only">Supply report</legend>
          {REPORT_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              type="button"
              disabled={busy}
              onClick={() => void report(opt.value)}
              className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-ink-900/10 bg-white px-2 py-3 text-sm font-semibold shadow-card transition hover:border-teal-650 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300"
            >
              <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${opt.dot}`} />
              {opt.label}
            </button>
          ))}
        </fieldset>
      </div>

      <div className="card">
        <h2 className="font-semibold">Become a Pad Champion</h2>
        <p className="mt-1 text-sm text-ink-500">
          Champions keep this point stocked: verify supply, confirm restocks, and coordinate
          donations. {station.champion_count} champion
          {station.champion_count === 1 ? "" : "s"} currently support this station.
        </p>
        <button type="button" onClick={adopt} disabled={busy} className="btn-primary mt-3">
          Adopt this station
        </button>
        {station.champion_count > 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void report(station.current_supply, true)}
            className="btn-secondary mt-2 !py-2 !text-base"
          >
            Champion: verify current supply
          </button>
        )}
      </div>

      <Link href={`/donate`} className="btn-secondary">
        Donate pads to the network
      </Link>

      {notice && (
        <output className="card block text-center text-sm font-medium text-teal-650">
          {notice}
        </output>
      )}
    </div>
  );
}

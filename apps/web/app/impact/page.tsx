"use client";

import { useEffect, useState } from "react";
import { ArrowRight, ClipboardList, Gift, HeartHandshake, MapPin, Package, RefreshCw } from "lucide-react";
import { StationCard } from "@/components/StationCard";
import { api } from "@/lib/api";
import type { Impact } from "@/lib/types";

function Stat({ value, label }: Readonly<{ value: number | string; label: string }>) {
  return (
    <div className="card text-center">
      <p className="text-3xl font-bold text-teal-650">{value.toLocaleString()}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-ink-500">{label}</p>
    </div>
  );
}

export default function ImpactPage() {
  const [impact, setImpact] = useState<Impact | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.impact().then(setImpact).catch(() => setError("Couldn't load impact data."));
  }, []);

  if (error) return <p className="card mt-6 text-sm text-rose-800">{error}</p>;
  if (!impact) return <p className="pt-8 text-center text-ink-500">Loading impact…</p>;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold">PadForward network</h1>
        {impact.demo_network && (
          <p className="text-xs font-semibold text-plum-600">
            Demo network — figures are seeded demonstration data.
          </p>
        )}
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3" aria-label="Network totals">
        <Stat value={impact.stations} label="Stations" />
        <Stat value={impact.donors} label="Community donors" />
        <Stat value={impact.champions} label="Pad Champions" />
        <Stat value={impact.pads_donated} label="Pads donated" />
        <Stat value={impact.restocks} label="Restocks" />
        <Stat value={impact.requests_fulfilled} label="Requests fulfilled" />
      </section>

      <section className="card" aria-label="Today">
        <h2 className="font-semibold">Today</h2>
        <ul className="mt-2 space-y-1.5 text-sm text-ink-700">
          <li className="flex items-center gap-2">
            <Gift aria-hidden="true" className="h-4 w-4 text-teal-650" />
            {impact.today_pads_donated} pads donated
          </li>
          <li className="flex items-center gap-2">
            <ClipboardList aria-hidden="true" className="h-4 w-4 text-teal-650" />
            {impact.today_supply_reports} supply reports
          </li>
          <li className="flex items-center gap-2">
            <Package aria-hidden="true" className="h-4 w-4 text-teal-650" />
            {impact.today_restocks} restocks
          </li>
        </ul>
      </section>

      <section aria-label="The generosity loop" className="card !p-6">
        <h2 className="text-center font-semibold">The generosity loop</h2>
        <ol className="mt-5 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-center">
          {[
            {
              Icon: Gift,
              value: impact.donors.toLocaleString(),
              label: impact.donors === 1 ? "donor gives" : "donors give",
            },
            {
              Icon: MapPin,
              value: impact.stations.toLocaleString(),
              label: "stations stocked",
            },
            {
              Icon: Package,
              value: impact.pads_donated.toLocaleString(),
              label: "pads shared",
            },
            {
              Icon: HeartHandshake,
              value: null,
              label: "received privately — no asking",
            },
          ].map((step, i, steps) => (
            <li key={step.label} className="flex flex-col items-center gap-2 sm:flex-row">
              <div className="flex w-full min-w-[130px] flex-col items-center rounded-xl2 bg-teal-50 px-4 py-3 text-center sm:w-auto">
                <step.Icon aria-hidden="true" className="h-5 w-5 text-teal-650" />
                {step.value !== null && (
                  <p className="mt-1 text-lg font-bold leading-none text-teal-800">{step.value}</p>
                )}
                <p className="mt-1 text-xs font-medium text-ink-700">{step.label}</p>
              </div>
              {i < steps.length - 1 && (
                <ArrowRight
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 rotate-90 text-ink-300 sm:rotate-0"
                />
              )}
            </li>
          ))}
        </ol>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-ink-500">
          <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
          When they're able, they give back — and the loop continues.
        </p>
      </section>

      {impact.urgent_stations.length > 0 && (
        <section aria-label="Urgent locations" className="flex flex-col gap-3">
          <h2 className="font-semibold">Urgent locations</h2>
          {impact.urgent_stations.map((s) => (
            <StationCard key={s.id} station={s} showNeed href={`/stations/${s.id}`} />
          ))}
        </section>
      )}
    </div>
  );
}

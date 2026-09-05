"use client";

import { useEffect, useState } from "react";
import { ClipboardList, Gift, Package } from "lucide-react";
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

      <section aria-label="The generosity loop" className="card text-center text-sm">
        <h2 className="font-semibold">The generosity loop</h2>
        <div className="mt-3 flex flex-col items-center gap-1 text-ink-700">
          <p className="font-semibold">{impact.donors.toLocaleString()} donors</p>
          <span aria-hidden="true">↓</span>
          <p className="font-semibold">{impact.stations} community stations</p>
          <span aria-hidden="true">↓</span>
          <p className="font-semibold">{impact.pads_donated.toLocaleString()} pads shared</p>
          <span aria-hidden="true">↓</span>
          <p className="font-semibold">Community members — privately, no asking</p>
        </div>
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

"use client";

/** Help a Station — pick a community point to support as a Pad Champion. */
import { useEffect, useState } from "react";
import { StationCard } from "@/components/StationCard";
import { api } from "@/lib/api";
import type { Station } from "@/lib/types";

export default function ChampionPage() {
  const [stations, setStations] = useState<Station[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .priorityStations(undefined, undefined, 10)
      .then(setStations)
      .catch(() => setError("Couldn't load stations."));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Help a station</h1>
      <p className="text-ink-500">
        Pad Champions adopt a community point and keep it going — verifying supply, reporting
        shortages, and coordinating donations. Stations with the highest need are listed first.
      </p>
      {error && <p className="card text-sm text-rose-800">{error}</p>}
      <ul className="flex flex-col gap-3" aria-label="Stations needing champions">
        {stations.map((s) => (
          <li key={s.id}>
            <StationCard station={s} showNeed href={`/stations/${s.id}`} />
          </li>
        ))}
      </ul>
    </div>
  );
}

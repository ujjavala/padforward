"use client";

/**
 * Find a Pad — the emotional core of PadForward.
 * Quiet Mode: anonymous, minimal UI, no signup, no public request.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, HeartHandshake } from "lucide-react";
import { MapView } from "@/components/MapView";
import { StationCard } from "@/components/StationCard";
import { DEMO_LOCATION, useGeolocation } from "@/hooks/useGeolocation";
import { api, directionsUrl } from "@/lib/api";
import { SUPPLY_META, isStale, timeAgo } from "@/lib/display";
import { analyzeSupplyPhoto, type VisionEstimate } from "@/lib/visionReport";
import type { Station } from "@/lib/types";

type Phase = "locate" | "list" | "detail" | "received";

export default function FindPage() {
  const { state, locate } = useGeolocation();
  const [phase, setPhase] = useState<Phase>("locate");
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [selected, setSelected] = useState<Station | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [remaining, setRemaining] = useState<string>("");
  const [analyzing, setAnalyzing] = useState(false);
  const [estimate, setEstimate] = useState<VisionEstimate | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setAnalyzing(true);
    setPhotoError(null);
    setEstimate(null);
    try {
      const result = await analyzeSupplyPhoto(file);
      if (result) {
        setEstimate(result);
        setRemaining(String(result.count));
      } else {
        setPhotoError("AI couldn't read that photo — enter the count manually.");
      }
    } catch {
      setPhotoError("Photo analysis isn't available right now — enter the count manually.");
    } finally {
      setAnalyzing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const loadStations = useCallback(async (lat: number, lng: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.nearbyStations(lat, lng);
      setStations(result);
      setOrigin({ lat, lng });
      setPhase("list");
    } catch {
      setError("We couldn't reach the network. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (state.status === "granted") {
      void loadStations(state.lat, state.lng);
    }
  }, [state, loadStations]);

  const available = stations.filter((s) => s.supply_status === "PLENTY" || s.supply_status === "A_FEW");
  const unavailable = stations.filter((s) => !available.includes(s));

  if (phase === "locate") {
    return (
      <div className="flex flex-col gap-4 pt-8 text-center">
        <h1 className="text-2xl font-bold">Need a pad?</h1>
        <p className="text-ink-500">
          We&apos;ll find the nearest community supply. No account. No questions.
        </p>
        <button
          type="button"
          onClick={locate}
          className="btn-primary"
          disabled={state.status === "locating"}
        >
          {state.status === "locating" ? "Finding you…" : "Use my location"}
        </button>
        {state.status === "denied" && (
          <div className="card text-sm">
            <p className="text-ink-700">
              We can&apos;t determine your location. Search near a station instead.
            </p>
            <button
              type="button"
              className="btn-secondary mt-3"
              onClick={() => void loadStations(DEMO_LOCATION.lat, DEMO_LOCATION.lng)}
            >
              Browse Sydney CBD stations
            </button>
          </div>
        )}
        <button
          type="button"
          className="text-sm text-ink-500 underline"
          onClick={() => void loadStations(DEMO_LOCATION.lat, DEMO_LOCATION.lng)}
        >
          Skip — browse demo stations
        </button>
      </div>
    );
  }

  if (phase === "received" && selected) {
    return (
      <div className="flex flex-col gap-5 pt-10 text-center">
        <HeartHandshake aria-hidden="true" className="mx-auto h-10 w-10 text-teal-650" />
        <h1 className="text-2xl font-bold">Someone left one for you.</h1>
        <p className="text-ink-500">When you&apos;re able, pay it forward.</p>
        <a href="/donate" className="btn-primary">
          Donate when you can
        </a>
        <a href="/" className="btn-secondary">
          Done
        </a>
        <p className="text-xs text-ink-300">
          No account was created. Nothing about you was stored.
        </p>
      </div>
    );
  }

  if (phase === "detail" && selected && origin) {
    const meta = SUPPLY_META[selected.supply_status];
    return (
      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={() => setPhase("list")}
          className="self-start text-sm font-medium text-teal-650 underline"
        >
          ← Back to nearby stations
        </button>
        <div className="card">
          <h1 className="text-xl font-bold">{selected.name}</h1>
          <p className="text-sm text-ink-500">{selected.address}</p>
          <p className={`mt-2 flex items-center gap-1.5 text-lg font-semibold ${meta.text}`}>
            <meta.Icon aria-hidden="true" className="h-5 w-5" />
            <span>
              {meta.label}
              {selected.supply_status !== "UNKNOWN" && <> — {selected.current_supply} pads reported</>}
            </span>
          </p>
          <p className="text-sm text-ink-500">
            Verified {timeAgo(selected.last_verified_at)} · Community confidence:{" "}
            {selected.community_confidence.toLowerCase()}
          </p>
          {isStale(selected.last_verified_at) && (
            <p className="mt-1 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Supply was last verified {timeAgo(selected.last_verified_at)} — it may have changed.
            </p>
          )}
          {selected.walking_minutes !== null && (
            <p className="mt-2 font-semibold text-teal-650">
              {selected.walking_minutes} min walk ({selected.distance_km} km)
            </p>
          )}
        </div>
        <a
          href={directionsUrl(selected, origin)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary"
        >
          Get walking directions
        </a>
        <div className="card">
          <h2 className="font-semibold">I got a pad</h2>
          <p className="mt-1 text-sm text-ink-500">
            Optionally, how many were left? This helps the next person.
          </p>
          <div className="mt-2 flex gap-2">
            <label htmlFor="remaining" className="sr-only">
              Pads remaining (optional)
            </label>
            <input
              id="remaining"
              type="number"
              min={0}
              max={500}
              inputMode="numeric"
              placeholder="e.g. 8"
              value={remaining}
              onChange={(e) => setRemaining(e.target.value)}
              className="w-24 rounded-lg border border-ink-300 px-3 py-2"
            />
            <button
              type="button"
              className="btn-primary !w-auto flex-1 !py-2 !text-base"
              onClick={async () => {
                try {
                  await api.claimPad(
                    selected.id,
                    remaining === "" ? undefined : Number(remaining)
                  );
                } catch {
                  /* claim is best-effort; the thank-you still shows */
                }
                setPhase("received");
              }}
            >
              I received a pad
            </button>
          </div>
          <div className="mt-3 border-t border-ink-900/10 pt-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => void onPhoto(e.target.files?.[0])}
            />
            <button
              type="button"
              disabled={analyzing}
              onClick={() => fileRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-teal-300 bg-teal-50 px-4 py-2.5 text-sm font-semibold text-teal-800 transition hover:border-teal-650 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300"
            >
              <Camera aria-hidden="true" className="h-4 w-4" />
              {analyzing ? "Analyzing photo…" : "Not sure? Snap the box — AI counts for you"}
            </button>
            {estimate && (
              <p className="mt-1.5 text-xs text-ink-500">
                AI estimates <span className="font-semibold">~{estimate.count} pads</span> (
                {estimate.confidence} confidence,{" "}
                {estimate.provider === "gemini-vision" ? "Gemini vision" : "on-device browser AI"}
                ) — count filled in above. Adjust if it looks off.
              </p>
            )}
            {photoError && <p className="mt-1.5 text-xs text-rose-700">{photoError}</p>}
            <p className="mt-1.5 text-xs text-ink-300">
              The photo is analyzed and discarded — never stored.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Nearby community supply</h1>
      {loading && <p className="text-ink-500">Finding nearby supply…</p>}
      {error && (
        <div className="card text-sm text-rose-800">
          {error}{" "}
          <button type="button" className="underline" onClick={() => origin && loadStations(origin.lat, origin.lng)}>
            Retry
          </button>
        </div>
      )}
      {origin && stations.length > 0 && (
        <MapView
          stations={stations}
          origin={origin}
          selectedId={selected?.id}
          onSelect={(s) => {
            setSelected(s);
            setPhase("detail");
          }}
        />
      )}
      {available.length === 0 && !loading && stations.length > 0 && (
        <div className="card text-sm">
          <p className="font-semibold text-rose-800">
            No community supply is currently reported nearby.
          </p>
          <p className="mt-1 text-ink-500">
            The nearest points are listed below — you can report a shortage there so donors are
            alerted, or check a nearby pharmacy.
          </p>
        </div>
      )}
      <ul className="flex flex-col gap-3" aria-label="Nearby stations">
        {[...available, ...unavailable].map((s) => (
          <li key={s.id}>
            <StationCard
              station={s}
              onSelect={(st) => {
                setSelected(st);
                setPhase("detail");
              }}
            />
          </li>
        ))}
      </ul>
      {stations.length === 0 && !loading && !error && (
        <p className="card text-sm text-ink-500">
          No community points found in this area yet.
        </p>
      )}
    </div>
  );
}

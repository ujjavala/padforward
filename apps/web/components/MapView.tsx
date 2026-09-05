"use client";

/**
 * MapView — Google Maps JS API with graceful fallback.
 * If NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is missing or the script fails,
 * we render an accessible schematic map so the product still works.
 */
import { useEffect, useRef, useState } from "react";
import { SUPPLY_META } from "@/lib/display";
import type { Station } from "@/lib/types";

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

const PIN_COLOR: Record<Station["supply_status"], string> = {
  PLENTY: "#059669",
  A_FEW: "#d97706",
  NONE: "#e11d48",
  UNKNOWN: "#64748b",
};

declare global {
  interface Window {
    __padforwardMapsLoaded?: Promise<void>;
  }
}

function loadGoogleMaps(): Promise<void> {
  if (!MAPS_KEY) return Promise.reject(new Error("no key"));
  if (window.google?.maps) return Promise.resolve();
  if (!window.__padforwardMapsLoaded) {
    window.__padforwardMapsLoaded = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&loading=async`;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("maps failed"));
      document.head.appendChild(script);
    });
  }
  return window.__padforwardMapsLoaded;
}

export function MapView({
  stations,
  origin,
  onSelect,
  selectedId,
}: Readonly<{
  stations: Station[];
  origin?: { lat: number; lng: number };
  onSelect?: (station: Station) => void;
  selectedId?: number;
}>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const [mode, setMode] = useState<"loading" | "google" | "fallback">(
    MAPS_KEY ? "loading" : "fallback"
  );

  useEffect(() => {
    if (!MAPS_KEY) return;
    let cancelled = false;
    loadGoogleMaps()
      .then(() => !cancelled && setMode("google"))
      .catch(() => !cancelled && setMode("fallback"));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (mode !== "google" || !containerRef.current) return;
    const center = origin ??
      (stations[0]
        ? { lat: stations[0].latitude, lng: stations[0].longitude }
        : { lat: -33.8788, lng: 151.2067 });
    if (!mapRef.current) {
      mapRef.current = new google.maps.Map(containerRef.current, {
        center,
        zoom: 14,
        disableDefaultUI: true,
        zoomControl: true,
        clickableIcons: false,
      });
    }
    const map = mapRef.current;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const bounds = new google.maps.LatLngBounds();
    if (origin) {
      markersRef.current.push(
        new google.maps.Marker({
          map,
          position: origin,
          title: "Your location",
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 7,
            fillColor: "#0f766e",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
        })
      );
      bounds.extend(origin);
    }
    stations.forEach((s) => {
      const meta = SUPPLY_META[s.supply_status];
      const marker = new google.maps.Marker({
        map,
        position: { lat: s.latitude, lng: s.longitude },
        title: `${s.name} — ${meta.label}`,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: s.id === selectedId ? 12 : 9,
          fillColor: PIN_COLOR[s.supply_status],
          fillOpacity: 0.95,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      });
      marker.addListener("click", () => onSelect?.(s));
      markersRef.current.push(marker);
      bounds.extend({ lat: s.latitude, lng: s.longitude });
    });
    if (!bounds.isEmpty()) map.fitBounds(bounds, 48);
  }, [mode, stations, origin, onSelect, selectedId]);

  if (mode === "fallback") {
    return <SchematicMap stations={stations} onSelect={onSelect} selectedId={selectedId} />;
  }

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label="Map of nearby community supply points"
      className="h-64 w-full rounded-xl2 bg-slate-200 shadow-card"
    >
      {mode === "loading" && (
        <p className="p-4 text-center text-sm text-ink-500">Loading map…</p>
      )}
    </div>
  );
}

/** Accessible fallback when Google Maps is unavailable. */
function SchematicMap({
  stations,
  onSelect,
  selectedId,
}: Readonly<{
  stations: Station[];
  onSelect?: (station: Station) => void;
  selectedId?: number;
}>) {
  if (stations.length === 0) {
    return (
      <div className="card h-40 text-center text-sm text-ink-500">
        Map unavailable — station list is shown below.
      </div>
    );
  }
  const lats = stations.map((s) => s.latitude);
  const lngs = stations.map((s) => s.longitude);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const px = (v: number, min: number, max: number) =>
    max === min ? 50 : 10 + ((v - min) / (max - min)) * 80;

  return (
    <div className="card">
      <p className="mb-2 text-xs font-semibold text-ink-500">
        Schematic view (interactive map unavailable)
      </p>
      <svg
        viewBox="0 0 100 70"
        role="img"
        aria-label="Schematic map of community supply points"
        className="h-56 w-full rounded-lg bg-slate-50"
      >
        {stations.map((s) => {
          const x = px(s.longitude, minLng, maxLng);
          const y = 70 - px(s.latitude, minLat, maxLat) * 0.7;
          return (
            <g
              key={s.id}
              onClick={() => onSelect?.(s)}
              className="cursor-pointer"
              role="button"
              aria-label={`${s.name}: ${SUPPLY_META[s.supply_status].label}`}
            >
              <circle
                cx={x}
                cy={y}
                r={s.id === selectedId ? 4 : 3}
                fill={PIN_COLOR[s.supply_status]}
                stroke="#fff"
                strokeWidth="0.8"
              />
              <text x={x} y={y - 5} textAnchor="middle" fontSize="3.2" fill="#3a3a55">
                {s.name.replace(" Station", "")}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500" aria-hidden="true">
        {[
          { dot: "bg-emerald-500", label: "Available" },
          { dot: "bg-amber-500", label: "Low" },
          { dot: "bg-rose-500", label: "None" },
          { dot: "bg-slate-400", label: "Unknown" },
        ].map((item) => (
          <span key={item.label} className="flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${item.dot}`} />
            {item.label}
          </span>
        ))}
      </p>
    </div>
  );
}

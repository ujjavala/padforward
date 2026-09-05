"use client";

import { useCallback, useState } from "react";

export type GeoState =
  | { status: "idle" }
  | { status: "locating" }
  | { status: "granted"; lat: number; lng: number }
  | { status: "denied" };

/** Sydney CBD fallback used for the demo when permission is denied. */
export const DEMO_LOCATION = { lat: -33.8788, lng: 151.2067 };

export function useGeolocation() {
  const [state, setState] = useState<GeoState>({ status: "idle" });

  const locate = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({ status: "denied" });
      return;
    }
    setState({ status: "locating" });
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setState({
          status: "granted",
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      () => setState({ status: "denied" }),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  }, []);

  return { state, locate, setState };
}

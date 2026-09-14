import { useCallback, useState } from "react";
import type { MapCoordinate } from "../types";

export type GeolocationStatus = "idle" | "locating" | "ready" | "denied" | "unavailable";

export function useGeolocation() {
  const [status, setStatus] = useState<GeolocationStatus>("idle");
  const [position, setPosition] = useState<MapCoordinate | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus("unavailable");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (result) => {
        setPosition({ lat: result.coords.latitude, lng: result.coords.longitude });
        setAccuracy(result.coords.accuracy ?? null);
        setStatus("ready");
      },
      (error) => {
        setAccuracy(null);
        setStatus(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable");
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
  }, []);

  return { status, position, accuracy, locate };
}

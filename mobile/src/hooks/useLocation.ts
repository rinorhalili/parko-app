import { useCallback, useState } from "react";
import * as Location from "expo-location";

export function useLocation() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const locate = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setError("Lokacioni nuk u lejua");
        return null;
      }
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setError("Aktivizo GPS/lokacionin ne telefon");
        return null;
      }

      const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: 60_000, requiredAccuracy: 100 });
      const next = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        mayShowUserSettingsDialog: true,
        timeInterval: 1_000,
      }).catch(async () => {
        const fallback = lastKnown ?? await Location.getLastKnownPositionAsync({ maxAge: 10 * 60_000 });
        if (fallback) return fallback;
        throw new Error("Nuk u gjet lokacioni");
      });
      setLocation(next);
      return next;
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Nuk u gjet lokacioni");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { location, loading, error, locate };
}

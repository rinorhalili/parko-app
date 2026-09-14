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
      const next = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocation(next);
      return next;
    } finally {
      setLoading(false);
    }
  }, []);

  return { location, loading, error, locate };
}

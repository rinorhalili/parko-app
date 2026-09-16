import { useMemo, useState } from "react";
import type { Filters, Parking } from "../types";

export const defaultParkingFilters: Filters = {
  availableOnly: false,
  verifiedOnly: false,
  maxPrice: 2,
  type: "all",
  freeOnly: false,
  paidOnly: false,
  evCharging: false,
  accessible: false,
  mapMarkerFilter: "all",
};

export function useParkingFilters(parkings: Parking[], initial: Filters = defaultParkingFilters) {
  const [filters, setFilters] = useState(initial);
  const filteredParkings = useMemo(
    () =>
      parkings.filter((parking) => {
        if (filters.availableOnly && parking.status !== "available") return false;
        if (filters.verifiedOnly && parking.confidence === "low") return false;
        if (filters.freeOnly && !(parking.free && parking.pricingSource)) return false;
        if (
          filters.paidOnly &&
          !(
            parking.pricePerHour !== null &&
            parking.pricePerHour > 0 &&
            parking.pricingSource
          )
        )
          return false;
        if (filters.evCharging && !parking.evCharging) return false;
        if (filters.accessible && !parking.accessible) return false;
        if (filters.type === "municipal" && !parking.municipalManaged) return false;
        if (filters.type !== "all" && filters.type !== "municipal" && parking.type !== filters.type) return false;
        if (parking.pricePerHour !== null && parking.pricePerHour > filters.maxPrice) return false;
        return true;
      }),
    [filters, parkings],
  );
  return { filters, setFilters, filteredParkings };
}

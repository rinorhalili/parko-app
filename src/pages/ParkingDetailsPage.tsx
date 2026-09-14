import { useEffect, useState } from "react";
import { getParking } from "../api/parkingService";
import type { ParkingSpot } from "../api/types";
import { Layout } from "../components/Layout";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { ParkingDetailsPanel } from "../components/ParkingDetailsPanel";
import { ParkingReportForm } from "../components/ParkingReportForm";

function getParkingId() {
  return decodeURIComponent(window.location.pathname.split("/").filter(Boolean).pop() ?? "");
}

export default function ParkingDetailsPage() {
  const [parking, setParking] = useState<ParkingSpot | null>(null);
  const [error, setError] = useState("");
  const id = getParkingId();

  useEffect(() => {
    if (!id) return;
    void getParking(id).then(setParking).catch((next) => setError(next instanceof Error ? next.message : "Parkingu nuk u gjet."));
  }, [id]);

  return (
    <Layout title="Detajet">
      {!id && <ErrorState title="Mungon parkingu" />}
      {id && !parking && !error && <LoadingState />}
      {error && <ErrorState message={error} onRetry={() => window.location.reload()} />}
      {parking && (
        <>
          <ParkingDetailsPanel parking={parking} />
          <ParkingReportForm parkingSpotId={parking.id} latitude={parking.latitude} longitude={parking.longitude} />
        </>
      )}
    </Layout>
  );
}

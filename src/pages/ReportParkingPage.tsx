import { useEffect, useState } from "react";
import { listParking } from "../api/parkingService";
import type { ParkingSpot } from "../api/types";
import { Layout } from "../components/Layout";
import { LoadingState } from "../components/LoadingState";
import { ParkingReportForm } from "../components/ParkingReportForm";
import { ProtectedRoute } from "../components/ProtectedRoute";

export default function ReportParkingPage() {
  const [parkings, setParkings] = useState<ParkingSpot[]>([]);
  const [selected, setSelected] = useState<ParkingSpot | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void listParking().then((items) => { setParkings(items); setSelected(items[0] ?? null); }).finally(() => setLoading(false));
  }, []);
  return (
    <Layout title="Raporto parking">
      <ProtectedRoute>
        {loading && <LoadingState />}
        {selected && (
          <>
            <label>Zgjidh parkingun
              <select value={selected.id} onChange={(event) => setSelected(parkings.find((parking) => parking.id === event.target.value) ?? null)}>
                {parkings.map((parking) => <option value={parking.id} key={parking.id}>{parking.title}</option>)}
              </select>
            </label>
            <ParkingReportForm parkingSpotId={selected.id} latitude={selected.latitude} longitude={selected.longitude} />
          </>
        )}
      </ProtectedRoute>
    </Layout>
  );
}

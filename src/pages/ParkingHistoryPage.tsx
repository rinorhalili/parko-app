import { useEffect, useState } from "react";
import { listParkedHistory, type ParkedHistory } from "../api/parkingHistoryService";
import { EmptyState } from "../components/EmptyState";
import { Layout } from "../components/Layout";
import { LoadingState } from "../components/LoadingState";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { formatDateTime } from "../utils/date";

export default function ParkingHistoryPage() {
  const [history, setHistory] = useState<ParkedHistory[] | null>(null);
  useEffect(() => {
    void listParkedHistory().then(setHistory).catch(() => setHistory([]));
  }, []);
  return (
    <Layout title="Historiku">
      <ProtectedRoute>
        {!history ? <LoadingState /> : history.length === 0 ? <EmptyState title="Ende pa historik parkimi" /> : history.map((item) => (
          <article className="parking-card" key={item.id}>
            <div className="parking-card__content">
              <strong>{formatDateTime(item.parkedAt)}</strong>
              <small>{item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}</small>
              {item.note && <p>{item.note}</p>}
            </div>
          </article>
        ))}
      </ProtectedRoute>
    </Layout>
  );
}

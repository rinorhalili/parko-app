import { useEffect, useState } from "react";
import { cancelReservation, listMyReservations, type Reservation } from "../api/reservationService";
import { EmptyState } from "../components/EmptyState";
import { Layout } from "../components/Layout";
import { LoadingState } from "../components/LoadingState";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { formatDateTime } from "../utils/date";

export default function ReservationPage() {
  const [reservations, setReservations] = useState<Reservation[] | null>(null);
  useEffect(() => {
    void listMyReservations({ scope: "all", pageSize: 50 }).then((page) => setReservations(page.items)).catch(() => setReservations([]));
  }, []);

  async function cancel(id: string) {
    await cancelReservation(id);
    setReservations((current) => current?.map((item) => item.id === id ? { ...item, cancelledAt: new Date().toISOString() } : item) ?? null);
  }

  return (
    <Layout title="Rezervimet">
      <ProtectedRoute>
        {!reservations ? <LoadingState /> : reservations.length === 0 ? <EmptyState title="Nuk ke rezervime" /> : reservations.map((reservation) => (
          <article className="parking-card" key={reservation.id}>
            <div className="parking-card__content">
              <strong>{reservation.parkingSpot?.title ?? reservation.parkingSpotId}</strong>
              <small>{formatDateTime(reservation.startsAt)} - {formatDateTime(reservation.expiresAt)}</small>
              {reservation.cancelledAt && <p>Anuluar</p>}
            </div>
            {!reservation.cancelledAt && <button className="button button--secondary" onClick={() => void cancel(reservation.id)}>Anulo</button>}
          </article>
        ))}
      </ProtectedRoute>
    </Layout>
  );
}

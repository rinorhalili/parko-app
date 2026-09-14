import type { ParkingSpot } from "../api/types";

export function ParkingDetailsPanel({ parking }: { parking: ParkingSpot }) {
  return (
    <section className="details-sheet">
      <h1>{parking.title}</h1>
      <p className="muted-copy">{parking.description ?? parking.address ?? "Parking në Prishtinë"}</p>
      <div className="stat-grid">
        <div><span>Statusi</span><strong>{parking.status}</strong></div>
        <div><span>Tipi</span><strong>{parking.type}</strong></div>
        <div><span>Kapaciteti</span><strong>{parking.capacity ?? "?"}</strong></div>
      </div>
    </section>
  );
}

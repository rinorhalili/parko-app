import type { NearbyParkingSpot, ParkingSpot } from "../api/types";
import { formatDistance } from "../utils/distance";

type ParkingCardItem = ParkingSpot | NearbyParkingSpot;

export function ParkingCard({ parking, onOpen }: { parking: ParkingCardItem; onOpen?: (parking: ParkingCardItem) => void }) {
  const distance = "distance" in parking ? formatDistance(parking.distance) : "";
  return (
    <article className="parking-card">
      <div className="parking-card__content">
        <strong>{parking.title}</strong>
        <small>{parking.address ?? parking.zone ?? "Prishtinë"}{distance ? ` • ${distance}` : ""}</small>
        <span className="parking-kind">{parking.status}</span>
      </div>
      {onOpen && <button className="button button--secondary" onClick={() => onOpen(parking)}>Hap</button>}
    </article>
  );
}

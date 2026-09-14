import { useState } from "react";
import type { FormEvent } from "react";
import { createParkingReport } from "../api/reportService";
import type { ParkingStatus } from "../api/types";

export function ParkingReportForm({ parkingSpotId, latitude, longitude, onCreated }: { parkingSpotId: string; latitude: number; longitude: number; onCreated?: () => void }) {
  const [status, setStatus] = useState<Extract<ParkingStatus, "AVAILABLE" | "OCCUPIED" | "UNKNOWN">>("AVAILABLE");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await createParkingReport({ parkingSpotId, latitude, longitude, status, description: description || undefined });
      onCreated?.();
      setDescription("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="profile-form" onSubmit={submit}>
      <label>Statusi
        <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
          <option value="AVAILABLE">Ka vende</option>
          <option value="OCCUPIED">Plot</option>
          <option value="UNKNOWN">Nuk dihet</option>
        </select>
      </label>
      <label>Shënim
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} />
      </label>
      <button disabled={submitting}>{submitting ? "Duke dërguar..." : "Dërgo raport"}</button>
    </form>
  );
}

import { useEffect, useState } from "react";
import { listAdminParking, updateAdminParkingStatus } from "../api/adminService";
import type { ParkingSpot } from "../api/types";
import { Layout } from "../components/Layout";
import { LoadingState } from "../components/LoadingState";
import { RoleGuard } from "../components/RoleGuard";

export default function ModerationPage() {
  const [items, setItems] = useState<ParkingSpot[] | null>(null);
  useEffect(() => {
    void listAdminParking(0, "", "pending").then((page) => setItems(page.items)).catch(() => setItems([]));
  }, []);
  async function moderate(id: string, action: "approve" | "disable") {
    const updated = await updateAdminParkingStatus(id, action);
    setItems((current) => current?.map((item) => item.id === id ? updated : item) ?? null);
  }
  return (
    <Layout title="Moderimi">
      <RoleGuard minRole="MODERATOR">
        {!items ? <LoadingState /> : items.map((parking) => (
          <article className="parking-card" key={parking.id}>
            <div className="parking-card__content">
              <strong>{parking.title}</strong>
              <small>{parking.address ?? parking.zone ?? "Prishtinë"}</small>
            </div>
            <button className="button button--secondary" onClick={() => void moderate(parking.id, "approve")}>Aprovo</button>
            <button className="button button--secondary" onClick={() => void moderate(parking.id, "disable")}>Blloko</button>
          </article>
        ))}
      </RoleGuard>
    </Layout>
  );
}

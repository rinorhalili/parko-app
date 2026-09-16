import type { Role } from "@prisma/client";
import { adminRepository } from "../repositories/admin.repository.js";
import { auditRepository } from "../repositories/audit.repository.js";
import { badRequest } from "../utils/errors.js";
import { emitRealtime } from "../websocket/io.js";
type AdminParkingCategory = "public" | "street" | "prishtina" | "private";
function adminPointFields(category: AdminParkingCategory) {
  const labels: Record<AdminParkingCategory, string> = {
    public: "Publik",
    street: "Në rrugë",
    prishtina: "Prishtina Parking",
    private: "Privat",
  };
  return {
    title: `Admin point · ${labels[category]}`,
    description: "Parking point placed manually by an admin.",
    zone: category === "prishtina" ? "Prishtina Parking" : "Admin parking point",
    type: category === "private" ? "PRIVATE" as const : category === "street" || category === "prishtina" ? "STREET" as const : "LOT" as const,
  };
}
export class AdminService {
  async listParking(page: number, q: string, scope: string) {
    const where = { ...(scope === "pending" ? { ownerId: { not: null }, verifiedAt: null, status: { not: "TEMPORARILY_UNAVAILABLE" as const } } : scope === "disabled" ? { status: "TEMPORARILY_UNAVAILABLE" as const } : {}), ...(q ? { OR: ["title", "address", "id"].map((field) => ({ [field]: { contains: q, mode: "insensitive" as const } })) } : {}) };
    const [items, total] = await adminRepository.listParking(where, page * 50); return { items, total, page, pageSize: 50 };
  }
  async manageParking(adminId: string, id: string, input: { action: "approve" | "disable"; reason?: string; title?: string; description?: string | null; address?: string | null; zone?: string | null; capacity?: number | null }) {
    const { action, reason, ...fields } = input; if (action === "disable" && !reason) throw badRequest("A reason is required");
    const updated = await adminRepository.updateParking(id, { ...fields, status: action === "approve" ? "UNKNOWN" : "TEMPORARILY_UNAVAILABLE", ...(action === "approve" ? { verifiedAt: new Date(), reportedAt: null } : {}) });
    await auditRepository.create({ actorId: adminId, action: `parking.${action}`, target: updated.id, metadata: { reason: reason ?? null } }); emitRealtime("parking:status.changed", { parkingSpotId: updated.id, status: updated.status }, updated.zone ? `zone:${updated.zone}` : undefined); return updated;
  }
  async createParkingPoint(adminId: string, input: { latitude: number; longitude: number; parkingType: AdminParkingCategory }) {
    const fields = adminPointFields(input.parkingType);
    const created = await adminRepository.createParking({
      ...fields,
      latitude: input.latitude,
      longitude: input.longitude,
      status: "UNKNOWN",
      verifiedAt: new Date(),
      owner: { connect: { id: adminId } },
    });
    await auditRepository.create({ actorId: adminId, action: "parking.point.create", target: created.id, metadata: { latitude: created.latitude, longitude: created.longitude, parkingType: input.parkingType } });
    emitRealtime("parking:updated", created);
    return created;
  }
  async updateParkingPoint(adminId: string, id: string, input: { latitude?: number; longitude?: number; parkingType?: AdminParkingCategory }) {
    const typeFields = input.parkingType ? adminPointFields(input.parkingType) : {};
    const updated = await adminRepository.updateParking(id, {
      ...typeFields,
      ...(input.latitude === undefined ? {} : { latitude: input.latitude }),
      ...(input.longitude === undefined ? {} : { longitude: input.longitude }),
    });
    await auditRepository.create({ actorId: adminId, action: "parking.point.update", target: id, metadata: input });
    emitRealtime("parking:updated", updated);
    return updated;
  }
  async deleteParkingPoint(adminId: string, id: string) {
    const deleted = await adminRepository.deleteParking(id);
    await auditRepository.create({ actorId: adminId, action: "parking.point.delete", target: id, metadata: { latitude: deleted.latitude, longitude: deleted.longitude } });
    emitRealtime("parking:deleted", { parkingSpotId: id });
    return deleted;
  }
  listUsers() { return adminRepository.listUsers(); }
  async updateUser(adminId: string, currentId: string, id: string, input: { isActive?: boolean; isVerified?: boolean }) { if (id === currentId && input.isActive === false) throw badRequest("You cannot deactivate your own account"); const user = await adminRepository.updateUser(id, input); await auditRepository.create({ actorId: adminId, action: "user.updated", target: id, metadata: input }); return user; }
  async updateRole(adminId: string, id: string, role: Role) { if (id === adminId) throw badRequest("You cannot change your own admin role"); const user = await adminRepository.updateUser(id, { role }); await auditRepository.create({ actorId: adminId, action: "user.role.update", target: id, metadata: { role } }); return user; }
  async analytics() { const [users, parkingReports, posts, comments, contentReports, notifications] = await adminRepository.counts(); return { users, parkingReports, posts, comments, contentReports, notifications }; }
}
export const adminService = new AdminService();

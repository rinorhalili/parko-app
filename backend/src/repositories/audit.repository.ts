import type { Prisma } from "@prisma/client";
import { prisma } from "../database/prisma.js";
export class AuditRepository {
  create(data: Prisma.AuditLogUncheckedCreateInput) { return prisma.auditLog.create({ data }); }
  list(skip = 0, take = 100) { return prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, skip, take, include: { actor: { select: { id: true, username: true } } } }); }
}
export const auditRepository = new AuditRepository();

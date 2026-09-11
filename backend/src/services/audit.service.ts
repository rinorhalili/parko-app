import type { Request } from "express";
import type { Prisma } from "@prisma/client";
import { auditRepository } from "../repositories/audit.repository.js";
export class AuditService {
  log(action: string, request: Request, target?: string, metadata?: Record<string, unknown>) {
    return auditRepository.create({ actorId: request.user?.id, action, target, ipAddress: request.ip, metadata: metadata as Prisma.InputJsonValue | undefined });
  }
  list(page: number, pageSize: number) { return auditRepository.list(page * pageSize, pageSize); }
}
export const auditService = new AuditService();

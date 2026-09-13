import type { ModerationStatus, ReportTargetType } from "@prisma/client";
import { moderationRepository } from "../repositories/moderation.repository.js";
import { auditRepository } from "../repositories/audit.repository.js";
import { emitRealtime } from "../websocket/io.js";
import { prisma } from "../database/prisma.js";
import { forbidden } from "../utils/errors.js";
import { logger } from "../config/logger.js";
export class ModerationService {
  createReport(reporterId: string, input: { targetType: ReportTargetType; targetId: string; reason: string }) { return moderationRepository.createReport({ ...input, reporterId }); }
  listReports({ status, page = 0, pageSize = 25 }: { status?: ModerationStatus; page?: number; pageSize?: number } = {}) { return moderationRepository.listReports({ status, skip: page * pageSize, take: pageSize }); }
  getReport(id: string) { return moderationRepository.findReport(id); }
  async review(id: string, moderatorId: string, input: { status: ModerationStatus; action?: string }) {
    const updated = await moderationRepository.updateReport(id, { ...input, moderator: { connect: { id: moderatorId } }, resolvedAt: input.status === "RESOLVED" ? new Date() : undefined });
    emitRealtime("community:moderation.updated", updated, "community"); emitRealtime("moderation:update", updated, "community"); return updated;
  }
  async createAction(moderatorId: string, input: { targetType: string; targetId: string; action: string; reason: string }) {
    const action = await moderationRepository.createAction({ ...input, moderatorId });
    await auditRepository.create({ actorId: moderatorId, action: `moderation.${input.action}`, target: `${input.targetType}:${input.targetId}` });
    if (input.action === "suspend" && input.targetType === "USER") {
      const target = await prisma.user.findUnique({ where: { id: input.targetId }, select: { role: true } });
      if (target?.role === "ADMIN" || target?.role === "MODERATOR") throw forbidden("Cannot suspend a moderator or admin through content moderation");
    }
    try {
      if (input.action === "hide" && input.targetType === "POST") await prisma.post.update({ where: { id: input.targetId }, data: { deletedAt: new Date() } });
      if (input.action === "hide" && input.targetType === "COMMENT") await prisma.comment.update({ where: { id: input.targetId }, data: { deletedAt: new Date() } });
      if (input.action === "restore" && input.targetType === "POST") await prisma.post.update({ where: { id: input.targetId }, data: { deletedAt: null } });
      if (input.action === "restore" && input.targetType === "COMMENT") await prisma.comment.update({ where: { id: input.targetId }, data: { deletedAt: null } });
      if (input.action === "suspend" && input.targetType === "USER") await prisma.user.update({ where: { id: input.targetId }, data: { isActive: false } });
      if (input.action === "reactivate" && input.targetType === "USER") await prisma.user.update({ where: { id: input.targetId }, data: { isActive: true } });
    } catch (error) {
      logger.warn({ err: error, targetType: input.targetType, targetId: input.targetId, action: input.action }, "Moderation action target update failed");
    }
    return action;
  }
}
export const moderationService = new ModerationService();

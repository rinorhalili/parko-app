import type { ModerationStatus, ReportTargetType } from "@prisma/client";
import { moderationRepository } from "../repositories/moderation.repository.js";
import { auditRepository } from "../repositories/audit.repository.js";
import { emitRealtime } from "../websocket/io.js";
export class ModerationService {
  createReport(reporterId: string, input: { targetType: ReportTargetType; targetId: string; reason: string }) { return moderationRepository.createReport({ ...input, reporterId }); }
  listReports() { return moderationRepository.listReports(); }
  getReport(id: string) { return moderationRepository.findReport(id); }
  async review(id: string, moderatorId: string, input: { status: ModerationStatus; action?: string }) {
    const updated = await moderationRepository.updateReport(id, { ...input, moderator: { connect: { id: moderatorId } }, resolvedAt: input.status === "RESOLVED" ? new Date() : undefined });
    emitRealtime("community:moderation.updated", updated, "community"); emitRealtime("moderation:update", updated, "community"); return updated;
  }
  async createAction(moderatorId: string, input: { targetType: string; targetId: string; action: string; reason: string }) {
    const action = await moderationRepository.createAction({ ...input, moderatorId });
    await auditRepository.create({ actorId: moderatorId, action: `moderation.${input.action}`, target: `${input.targetType}:${input.targetId}` });
    return action;
  }
}
export const moderationService = new ModerationService();

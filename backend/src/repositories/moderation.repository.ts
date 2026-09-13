import type { Prisma } from "@prisma/client";
import { prisma } from "../database/prisma.js";
export class ModerationRepository {
  createReport(data: Prisma.ContentReportUncheckedCreateInput) { return prisma.contentReport.create({ data }); }
  async listReports({ status, skip, take }: { status?: "OPEN" | "REVIEWING" | "RESOLVED" | "DISMISSED"; skip: number; take: number }) {
    const where = status ? { status } : {};
    const [items, total] = await Promise.all([
      prisma.contentReport.findMany({ where, orderBy: { createdAt: "desc" }, skip, take, include: { reporter: { select: { id: true, username: true } }, moderator: { select: { id: true, username: true } } } }),
      prisma.contentReport.count({ where })
    ]);
    return { items, total };
  }
  findReport(id: string) { return prisma.contentReport.findUniqueOrThrow({ where: { id } }); }
  updateReport(id: string, data: Prisma.ContentReportUpdateInput) { return prisma.contentReport.update({ where: { id }, data }); }
  createAction(data: Prisma.ModerationActionUncheckedCreateInput) { return prisma.moderationAction.create({ data }); }
}
export const moderationRepository = new ModerationRepository();

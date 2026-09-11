import type { Prisma } from "@prisma/client";
import { prisma } from "../database/prisma.js";
export class ModerationRepository {
  createReport(data: Prisma.ContentReportUncheckedCreateInput) { return prisma.contentReport.create({ data }); }
  listReports() { return prisma.contentReport.findMany({ orderBy: { createdAt: "desc" }, take: 100 }); }
  findReport(id: string) { return prisma.contentReport.findUniqueOrThrow({ where: { id } }); }
  updateReport(id: string, data: Prisma.ContentReportUpdateInput) { return prisma.contentReport.update({ where: { id }, data }); }
  createAction(data: Prisma.ModerationActionUncheckedCreateInput) { return prisma.moderationAction.create({ data }); }
}
export const moderationRepository = new ModerationRepository();

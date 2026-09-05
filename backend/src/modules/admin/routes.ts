import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../database/prisma.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { ok } from "../../utils/apiResponse.js";

const idParams = z.object({ id: z.uuid() });
const userPatch = z.object({ isActive: z.boolean().optional(), isVerified: z.boolean().optional() });
const rolePatch = z.object({ role: z.enum(["USER", "MODERATOR", "ADMIN"]) });

export const adminRoutes = Router();
adminRoutes.use(authenticate, authorize("ADMIN"));

adminRoutes.get("/users", async (_req, res, next) => {
  try {
    ok(res, await prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 100, omit: { passwordHash: true } }));
  } catch (error) {
    next(error);
  }
});

adminRoutes.patch("/users/:id", validate({ params: idParams, body: userPatch }), async (req, res, next) => {
  try {
    ok(res, await prisma.user.update({ where: { id: req.params.id as string }, data: req.body, omit: { passwordHash: true } }));
  } catch (error) {
    next(error);
  }
});

adminRoutes.patch("/users/:id/role", validate({ params: idParams, body: rolePatch }), async (req, res, next) => {
  try {
    const userId = req.params.id as string;
    const user = await prisma.user.update({ where: { id: userId }, data: { role: req.body.role }, omit: { passwordHash: true } });
    await prisma.adminAction.create({ data: { adminId: req.user!.id, action: "user.role.update", targetId: userId, metadata: { role: req.body.role } } });
    ok(res, user);
  } catch (error) {
    next(error);
  }
});

adminRoutes.get("/analytics", async (_req, res, next) => {
  try {
    const [users, parkingReports, posts, comments, contentReports, notifications] = await Promise.all([
      prisma.user.count(),
      prisma.parkingReport.count(),
      prisma.post.count(),
      prisma.comment.count(),
      prisma.contentReport.count(),
      prisma.notification.count()
    ]);
    ok(res, { users, parkingReports, posts, comments, contentReports, notifications });
  } catch (error) {
    next(error);
  }
});

adminRoutes.get("/audit-logs", async (_req, res, next) => {
  try {
    ok(res, await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200 }));
  } catch (error) {
    next(error);
  }
});

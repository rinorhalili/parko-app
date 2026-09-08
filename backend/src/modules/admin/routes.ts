import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../database/prisma.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { badRequest } from "../../utils/errors.js";
import { ok } from "../../utils/apiResponse.js";

const idParams = z.object({ id: z.uuid() });
const userPatch = z.object({ isActive: z.boolean().optional(), isVerified: z.boolean().optional() });
const rolePatch = z.object({ role: z.enum(["USER", "MODERATOR", "ADMIN"]) });
const parkingPatch = z.object({
  action: z.enum(["approve", "disable"]),
  reason: z.string().trim().min(3).max(500).optional(),
  title: z.string().min(2).max(120).optional(),
  description: z.string().max(1000).nullable().optional(),
  address: z.string().max(200).nullable().optional(),
  zone: z.string().max(80).nullable().optional(),
  capacity: z.number().int().positive().nullable().optional()
});

export const adminRoutes = Router();
adminRoutes.use(authenticate, authorize("ADMIN"));

adminRoutes.get("/parking", validate({ query: z.object({ page: z.coerce.number().int().min(0).max(1000).default(0), q: z.string().trim().max(120).default(""), scope: z.enum(["pending", "all", "disabled"]).default("pending") }) }), async (req, res, next) => {
  try {
    const { page, q, scope } = req.query as unknown as { page: number; q: string; scope: string };
    const where = {
      ...(scope === 'pending' ? { ownerId: { not: null }, verifiedAt: null, status: { not: 'TEMPORARILY_UNAVAILABLE' as const } } : scope === 'disabled' ? { status: 'TEMPORARILY_UNAVAILABLE' as const } : {}),
      ...(q ? { OR: ['title', 'address', 'id'].map((field) => ({ [field]: { contains: q, mode: 'insensitive' as const } })) } : {})
    };
    const [items, total] = await Promise.all([
      prisma.parkingSpot.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], take: 50, skip: page * 50 }),
      prisma.parkingSpot.count({ where })
    ]);
    ok(res, { items, total, page, pageSize: 50 });
  } catch (error) {
    next(error);
  }
});

adminRoutes.patch("/parking/:id", validate({ params: z.object({ id: z.string().min(1).max(120) }), body: parkingPatch }), async (req, res, next) => {
  try {
    const { action, reason, ...fields } = req.body;
    if (action === 'disable' && !reason) throw badRequest('A reason is required');
    const spot = await prisma.$transaction(async (tx) => {
      const updated = await tx.parkingSpot.update({ where: { id: req.params.id as string }, data: {
        ...fields, status: action === 'approve' ? 'UNKNOWN' : 'TEMPORARILY_UNAVAILABLE',
        ...(action === 'approve' ? { verifiedAt: new Date(), reportedAt: null } : {})
      } });
      await tx.adminAction.create({ data: { adminId: req.user!.id, action: `parking.${action}`, targetId: updated.id, metadata: { reason: reason ?? null } } });
      return updated;
    });
    ok(res, spot);
  } catch (error) {
    next(error);
  }
});

adminRoutes.get("/users", async (_req, res, next) => {
  try {
    ok(res, await prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 100, omit: { passwordHash: true } }));
  } catch (error) {
    next(error);
  }
});

adminRoutes.patch("/users/:id", validate({ params: idParams, body: userPatch }), async (req, res, next) => {
  try {
    if (req.params.id === req.user!.id && req.body.isActive === false) throw badRequest('You cannot deactivate your own account');
    ok(res, await prisma.user.update({ where: { id: req.params.id as string }, data: req.body, omit: { passwordHash: true } }));
  } catch (error) {
    next(error);
  }
});

adminRoutes.patch("/users/:id/role", validate({ params: idParams, body: rolePatch }), async (req, res, next) => {
  try {
    const userId = req.params.id as string;
    if (userId === req.user!.id) throw badRequest('You cannot change your own admin role');
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

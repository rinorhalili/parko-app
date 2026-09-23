import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { prisma } from "../database/prisma.js";
import { getUserReputation } from "../modules/reputation/service.js";
import { userRepository } from "../repositories/user.repository.js";
import { ok } from "../utils/apiResponse.js";
import { badRequest } from "../utils/errors.js";
import { hashPassword, verifyPassword } from "../utils/password.js";

export const userController = {
  async me(req: Request, res: Response, next: NextFunction) { try { ok(res, await userRepository.me(req.user!.id)); } catch (error) { next(error); } },
  async profile(req: Request, res: Response, next: NextFunction) { try { ok(res, await userRepository.publicProfile(String(req.params.id))); } catch (error) { next(error); } },
  async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      ok(res, await prisma.user.update({ where: { id: req.user!.id }, data: req.body, omit: { passwordHash: true } }));
    } catch (error) {
      next(error);
    }
  },
  async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
      if (!(await verifyPassword(user.passwordHash, req.body.currentPassword))) throw badRequest("Current password is incorrect");
      await prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(req.body.newPassword) } });
        await tx.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
        await tx.auditLog.create({ data: { actorId: user.id, action: "auth.password.changed" } });
      });
      ok(res, { changed: true });
    } catch (error) {
      next(error);
    }
  },
  async listSessions(req: Request, res: Response, next: NextFunction) {
    try {
      const sessions = await prisma.refreshToken.findMany({
        where: { userId: req.user!.id, expiresAt: { gt: new Date() } },
        select: { id: true, userAgent: true, ipAddress: true, createdAt: true, expiresAt: true, revokedAt: true },
        orderBy: { createdAt: "desc" }
      });
      ok(res, sessions);
    } catch (error) {
      next(error);
    }
  },
  async revokeSession(req: Request, res: Response, next: NextFunction) {
    try {
      const sessionId = req.params.sessionId as string;
      const result = await prisma.refreshToken.updateMany({ where: { id: sessionId, userId: req.user!.id, revokedAt: null }, data: { revokedAt: new Date() } });
      if (result.count !== 1) throw badRequest("Session not found or already revoked");
      await prisma.auditLog.create({ data: { actorId: req.user!.id, action: "auth.session.revoked", target: sessionId } });
      ok(res, { revoked: true });
    } catch (error) {
      next(error);
    }
  },
  async exportData(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const [profile, reports, reservations, posts, comments, reputation, parkedHistory] = await Promise.all([
        prisma.user.findUniqueOrThrow({ where: { id: userId }, omit: { passwordHash: true } }),
        prisma.parkingReport.findMany({ where: { reporterId: userId }, orderBy: { createdAt: "desc" } }),
        prisma.parkingReservation.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
        prisma.post.findMany({ where: { authorId: userId }, orderBy: { createdAt: "desc" } }),
        prisma.comment.findMany({ where: { authorId: userId }, orderBy: { createdAt: "desc" } }),
        prisma.reputation.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
        prisma.parkedHistory.findMany({ where: { userId }, orderBy: { parkedAt: "desc" } })
      ]);
      await prisma.auditLog.create({ data: { actorId: userId, action: "privacy.data.exported" } });
      res.setHeader("Cache-Control", "no-store");
      res.attachment(`parko-data-export-${userId}.json`);
      res.json({ exportedAt: new Date().toISOString(), profile, reports, reservations, posts, comments, reputation, parkedHistory });
    } catch (error) {
      next(error);
    }
  },
  async deleteAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
      if (!(await verifyPassword(user.passwordHash, req.body.currentPassword))) throw badRequest("Current password is incorrect");

      await prisma.$transaction(async (tx) => {
        await tx.refreshToken.deleteMany({ where: { userId: user.id } });
        await tx.passwordResetToken.deleteMany({ where: { userId: user.id } });
        await tx.emailVerificationToken.deleteMany({ where: { userId: user.id } });
        await tx.parkingReportVote.deleteMany({ where: { userId: user.id } });
        await tx.webPushSubscription.deleteMany({ where: { userId: user.id } });
        await tx.pushDevice.deleteMany({ where: { userId: user.id } });
        await tx.parkingReservation.deleteMany({ where: { userId: user.id } });
        await tx.parkedHistory.deleteMany({ where: { userId: user.id } });
        await tx.favoriteParking.deleteMany({ where: { userId: user.id } });
        await tx.favoritePost.deleteMany({ where: { userId: user.id } });
        await tx.zoneAlert.deleteMany({ where: { userId: user.id } });
        await tx.reaction.deleteMany({ where: { userId: user.id } });
        await tx.notification.deleteMany({ where: { recipientId: user.id } });
        await tx.user.update({
          where: { id: user.id },
          data: {
            isActive: false,
            email: `deleted-${user.id}@parko.invalid`,
            username: `deleted-${user.id}`,
            name: "Përdorues i fshirë",
            avatar: null,
            bio: null,
            passwordHash: await hashPassword(randomUUID()),
          },
        });
      });

      res.clearCookie("parko_refresh", { httpOnly: true, secure: env.NODE_ENV === "production", sameSite: "strict" as const, path: "/api" });
      ok(res, { deleted: true });
    } catch (error) {
      next(error);
    }
  },
  async listBlocks(req: Request, res: Response, next: NextFunction) {
    try {
      const blocks = await prisma.userBlock.findMany({
        where: { blockerId: req.user!.id },
        select: { blockedId: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      });
      ok(res, blocks);
    } catch (error) {
      next(error);
    }
  },
  async blockUser(req: Request, res: Response, next: NextFunction) {
    try {
      const blockedId = String(req.params.id);
      if (blockedId === req.user!.id) throw badRequest("You cannot block your own account");
      const block = await prisma.userBlock.upsert({
        where: { blockerId_blockedId: { blockerId: req.user!.id, blockedId } },
        create: { blockerId: req.user!.id, blockedId },
        update: {},
      });
      ok(res, block);
    } catch (error) {
      next(error);
    }
  },
  async unblockUser(req: Request, res: Response, next: NextFunction) {
    try {
      await prisma.userBlock.deleteMany({ where: { blockerId: req.user!.id, blockedId: String(req.params.id) } });
      ok(res, { removed: true });
    } catch (error) {
      next(error);
    }
  },
  async publicReputation(req: Request, res: Response, next: NextFunction) {
    try {
      ok(res, await getUserReputation(req.params.id as string));
    } catch (error) {
      next(error);
    }
  },
  async activityFeed(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.params.id as string;
      const [reports, posts, comments, reservations] = await Promise.all([
        prisma.parkingReport.findMany({ where: { reporterId: userId }, select: { id: true, status: true, parkingSpotId: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 50 }),
        prisma.post.findMany({ where: { authorId: userId }, select: { id: true, title: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 50 }),
        prisma.comment.findMany({ where: { authorId: userId }, select: { id: true, postId: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 50 }),
        prisma.parkingReservation.findMany({ where: { userId }, select: { id: true, parkingSpotId: true, startsAt: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 50 })
      ]);
      const items = [
        ...reports.map((item) => ({ type: "PARKING_REPORT", ...item })),
        ...posts.map((item) => ({ type: "POST", ...item })),
        ...comments.map((item) => ({ type: "COMMENT", ...item })),
        ...reservations.map((item) => ({ type: "RESERVATION", ...item }))
      ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 100);
      ok(res, { items });
    } catch (error) {
      next(error);
    }
  },
  async leaderboard(_req: Request, res: Response, next: NextFunction) {
    try {
      const users = await prisma.user.findMany({ where: { isActive: true }, orderBy: [{ reputationScore: "desc" }, { createdAt: "asc" }], take: 100, select: { id: true, name: true, username: true, avatar: true, reputationScore: true, isVerified: true } });
      ok(res, { items: users.map((user, index) => ({ rank: index + 1, ...user })) });
    } catch (error) {
      next(error);
    }
  }
};

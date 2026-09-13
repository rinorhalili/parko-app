import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { env } from "../../config/env.js";
import { prisma } from "../../database/prisma.js";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { ok } from "../../utils/apiResponse.js";
import { hashPassword, verifyPassword } from "../../utils/password.js";
import { badRequest } from "../../utils/errors.js";
import { getUserReputation } from "../reputation/service.js";
import { userController } from "../../controllers/user.controller.js";

const idParams = z.object({ id: z.uuid() });
const profileSchema = z.object({ name: z.string().min(2).max(80).optional(), username: z.string().min(3).max(40).optional(), avatar: z.url().optional(), bio: z.string().max(500).optional() });
const passwordSchema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8).max(128) });
const deleteAccountSchema = z.object({ currentPassword: z.string().min(1) });

export const userRoutes = Router();

userRoutes.get("/me", authenticate, userController.me);

userRoutes.patch("/me", authenticate, validate({ body: profileSchema }), async (req, res, next) => {
  try {
    ok(res, await prisma.user.update({ where: { id: req.user!.id }, data: req.body, omit: { passwordHash: true } }));
  } catch (error) {
    next(error);
  }
});

userRoutes.patch("/me/password", authenticate, validate({ body: passwordSchema }), async (req, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    if (!(await verifyPassword(user.passwordHash, req.body.currentPassword))) throw badRequest("Current password is incorrect");
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(req.body.newPassword) } });
    ok(res, { changed: true });
  } catch (error) {
    next(error);
  }
});

userRoutes.delete("/me", authenticate, validate({ body: deleteAccountSchema }), async (req, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    if (!(await verifyPassword(user.passwordHash, req.body.currentPassword))) throw badRequest("Current password is incorrect");

    await prisma.$transaction(async (tx) => {
      await tx.refreshToken.deleteMany({ where: { userId: user.id } });
      await tx.passwordResetToken.deleteMany({ where: { userId: user.id } });
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

    res.clearCookie("parko_refresh", { httpOnly: true, secure: env.NODE_ENV === "production", sameSite: "strict", path: "/api" });
    ok(res, { deleted: true });
  } catch (error) {
    next(error);
  }
});

userRoutes.get("/:id", validate({ params: idParams }), userController.profile);

userRoutes.get("/:id/reputation", validate({ params: idParams }), async (req, res, next) => {
  try {
    ok(res, await getUserReputation(req.params.id as string));
  } catch (error) {
    next(error);
  }
});

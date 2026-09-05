import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../database/prisma.js";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { ok } from "../../utils/apiResponse.js";
import { hashPassword, verifyPassword } from "../../utils/password.js";
import { badRequest } from "../../utils/errors.js";
import { getUserReputation } from "../reputation/service.js";

const idParams = z.object({ id: z.uuid() });
const profileSchema = z.object({ name: z.string().min(2).max(80).optional(), username: z.string().min(3).max(40).optional(), avatar: z.url().optional(), bio: z.string().max(500).optional() });
const passwordSchema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8).max(128) });

export const userRoutes = Router();

userRoutes.get("/me", authenticate, async (req, res, next) => {
  try {
    ok(res, await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id }, omit: { passwordHash: true } }));
  } catch (error) {
    next(error);
  }
});

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

userRoutes.get("/:id", validate({ params: idParams }), async (req, res, next) => {
  try {
    ok(res, await prisma.user.findUniqueOrThrow({ where: { id: req.params.id as string }, omit: { passwordHash: true } }));
  } catch (error) {
    next(error);
  }
});

userRoutes.get("/:id/reputation", validate({ params: idParams }), async (req, res, next) => {
  try {
    ok(res, await getUserReputation(req.params.id as string));
  } catch (error) {
    next(error);
  }
});

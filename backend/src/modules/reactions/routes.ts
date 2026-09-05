import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../database/prisma.js";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { ok } from "../../utils/apiResponse.js";

const idParams = z.object({ id: z.uuid() });
const body = z.object({ type: z.enum(["LIKE", "HELPFUL", "THANKS"]).default("LIKE") });

export const reactionRoutes = Router();

reactionRoutes.post("/posts/:id/reactions", authenticate, validate({ params: idParams, body }), async (req, res, next) => {
  try {
    const postId = req.params.id as string;
    ok(res, await prisma.reaction.upsert({ where: { userId_postId: { userId: req.user!.id, postId } }, create: { userId: req.user!.id, postId, type: req.body.type }, update: { type: req.body.type } }), undefined, 201);
  } catch (error) {
    next(error);
  }
});

reactionRoutes.delete("/posts/:id/reactions", authenticate, validate({ params: idParams }), async (req, res, next) => {
  try {
    await prisma.reaction.deleteMany({ where: { userId: req.user!.id, postId: req.params.id as string } });
    ok(res, { removed: true });
  } catch (error) {
    next(error);
  }
});

reactionRoutes.post("/comments/:id/reactions", authenticate, validate({ params: idParams, body }), async (req, res, next) => {
  try {
    const commentId = req.params.id as string;
    ok(res, await prisma.reaction.upsert({ where: { userId_commentId: { userId: req.user!.id, commentId } }, create: { userId: req.user!.id, commentId, type: req.body.type }, update: { type: req.body.type } }), undefined, 201);
  } catch (error) {
    next(error);
  }
});

reactionRoutes.delete("/comments/:id/reactions", authenticate, validate({ params: idParams }), async (req, res, next) => {
  try {
    await prisma.reaction.deleteMany({ where: { userId: req.user!.id, commentId: req.params.id as string } });
    ok(res, { removed: true });
  } catch (error) {
    next(error);
  }
});

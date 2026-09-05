import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { ok } from "../../utils/apiResponse.js";
import { forbidden, notFound } from "../../utils/errors.js";
import { prisma } from "../../database/prisma.js";
import { emitRealtime } from "../../websocket/io.js";
import { idParams, postSchema } from "./validation.js";

export const postRoutes = Router();

postRoutes.get("/", async (_req, res, next) => {
  try {
    ok(res, await prisma.post.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 50, include: { author: { select: { id: true, username: true, reputationScore: true } }, _count: { select: { comments: true, reactions: true } } } }));
  } catch (error) {
    next(error);
  }
});

postRoutes.post("/", authenticate, validate({ body: postSchema }), async (req, res, next) => {
  try {
    const post = await prisma.post.create({ data: { ...req.body, authorId: req.user!.id } });
    emitRealtime("post:new", post, "community");
    ok(res, post, undefined, 201);
  } catch (error) {
    next(error);
  }
});

postRoutes.get("/:id", validate({ params: idParams }), async (req, res, next) => {
  try {
    const post = await prisma.post.findFirst({ where: { id: req.params.id as string, deletedAt: null }, include: { comments: true, reactions: true } });
    if (!post) throw notFound("Post not found");
    ok(res, post);
  } catch (error) {
    next(error);
  }
});

postRoutes.patch("/:id", authenticate, validate({ params: idParams, body: postSchema.partial() }), async (req, res, next) => {
  try {
    const post = await prisma.post.findUnique({ where: { id: req.params.id as string } });
    if (!post) throw notFound("Post not found");
    if (post.authorId !== req.user!.id && req.user!.role === "USER") throw forbidden();
    ok(res, await prisma.post.update({ where: { id: post.id }, data: req.body }));
  } catch (error) {
    next(error);
  }
});

postRoutes.delete("/:id", authenticate, validate({ params: idParams }), async (req, res, next) => {
  try {
    const post = await prisma.post.findUnique({ where: { id: req.params.id as string } });
    if (!post) throw notFound("Post not found");
    if (post.authorId !== req.user!.id && req.user!.role === "USER") throw forbidden();
    ok(res, await prisma.post.update({ where: { id: post.id }, data: { deletedAt: new Date() } }));
  } catch (error) {
    next(error);
  }
});

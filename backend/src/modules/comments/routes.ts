import { Router } from "express";
import { prisma } from "../../database/prisma.js";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { ok } from "../../utils/apiResponse.js";
import { forbidden, notFound } from "../../utils/errors.js";
import { emitRealtime } from "../../websocket/io.js";
import { commentSchema, idParams, postIdParams } from "./validation.js";

export const commentRoutes = Router();

commentRoutes.get("/posts/:postId/comments", validate({ params: postIdParams }), async (req, res, next) => {
  try {
    ok(res, await prisma.comment.findMany({ where: { postId: req.params.postId as string, deletedAt: null }, orderBy: { createdAt: "asc" }, include: { author: { select: { id: true, username: true } }, reactions: true } }));
  } catch (error) {
    next(error);
  }
});

commentRoutes.post("/posts/:postId/comments", authenticate, validate({ params: postIdParams, body: commentSchema }), async (req, res, next) => {
  try {
    const post = await prisma.post.findUnique({ where: { id: req.params.postId as string } });
    if (!post || post.deletedAt) throw notFound("Post not found");
    const comment = await prisma.comment.create({ data: { ...req.body, postId: post.id, authorId: req.user!.id } });
    if (post.authorId !== req.user!.id) {
      await prisma.notification.create({ data: { recipientId: post.authorId, type: "COMMENT", title: "New comment", message: "Someone commented on your post", data: { postId: post.id, commentId: comment.id } } });
    }
    emitRealtime("comment:new", comment, "community");
    ok(res, comment, undefined, 201);
  } catch (error) {
    next(error);
  }
});

commentRoutes.patch("/comments/:id", authenticate, validate({ params: idParams, body: commentSchema.pick({ content: true }) }), async (req, res, next) => {
  try {
    const comment = await prisma.comment.findUnique({ where: { id: req.params.id as string } });
    if (!comment) throw notFound("Comment not found");
    if (comment.authorId !== req.user!.id && req.user!.role === "USER") throw forbidden();
    ok(res, await prisma.comment.update({ where: { id: comment.id }, data: { content: req.body.content } }));
  } catch (error) {
    next(error);
  }
});

commentRoutes.delete("/comments/:id", authenticate, validate({ params: idParams }), async (req, res, next) => {
  try {
    const comment = await prisma.comment.findUnique({ where: { id: req.params.id as string } });
    if (!comment) throw notFound("Comment not found");
    if (comment.authorId !== req.user!.id && req.user!.role === "USER") throw forbidden();
    ok(res, await prisma.comment.update({ where: { id: comment.id }, data: { deletedAt: new Date() } }));
  } catch (error) {
    next(error);
  }
});

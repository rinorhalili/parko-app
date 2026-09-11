import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { communityController } from "../../controllers/community.controller.js";
import { commentSchema, idParams, postIdParams } from "./validation.js";

export const commentRoutes = Router();

commentRoutes.get("/posts/:postId/comments", validate({ params: postIdParams }), communityController.listComments);

commentRoutes.post("/posts/:postId/comments", authenticate, validate({ params: postIdParams, body: commentSchema }), communityController.createComment);

commentRoutes.patch("/comments/:id", authenticate, validate({ params: idParams, body: commentSchema.pick({ content: true }) }), communityController.updateComment);

commentRoutes.delete("/comments/:id", authenticate, validate({ params: idParams }), communityController.deleteComment);

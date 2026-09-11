import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { communityController } from "../../controllers/community.controller.js";

const idParams = z.object({ id: z.uuid() });
const body = z.object({ type: z.enum(["LIKE", "HELPFUL", "THANKS"]).default("LIKE") });

export const reactionRoutes = Router();

reactionRoutes.post("/posts/:id/reactions", authenticate, validate({ params: idParams, body }), communityController.reactPost);

reactionRoutes.delete("/posts/:id/reactions", authenticate, validate({ params: idParams }), communityController.removePostReaction);

reactionRoutes.post("/comments/:id/reactions", authenticate, validate({ params: idParams, body }), communityController.reactComment);

reactionRoutes.delete("/comments/:id/reactions", authenticate, validate({ params: idParams }), communityController.removeCommentReaction);

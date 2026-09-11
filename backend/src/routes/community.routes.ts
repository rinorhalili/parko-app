import { Router } from "express";
import { postRoutes } from "../modules/posts/routes.js";
import { commentRoutes } from "../modules/comments/routes.js";
import { reactionRoutes } from "../modules/reactions/routes.js";
import { moderationRoutes } from "../modules/moderation/routes.js";

/** Consolidated community namespace; legacy /posts and /comments endpoints remain mounted. */
export const communityRoutes = Router();
communityRoutes.use("/posts", postRoutes);
communityRoutes.use(commentRoutes);
communityRoutes.use(reactionRoutes);
communityRoutes.use("/moderation", moderationRoutes);

import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { userController } from "../../controllers/user.controller.js";

const idParams = z.object({ id: z.uuid() });
const profileSchema = z.object({ name: z.string().min(2).max(80).optional(), username: z.string().min(3).max(40).optional(), avatar: z.url().optional(), bio: z.string().max(500).optional() });
const passwordSchema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(12).max(128) });
const deleteAccountSchema = z.object({ currentPassword: z.string().min(1) });
const sessionParams = z.object({ sessionId: z.uuid() });

export const userRoutes = Router();

userRoutes.get("/me", authenticate, userController.me);

userRoutes.patch("/me", authenticate, validate({ body: profileSchema }), userController.updateProfile);

userRoutes.patch("/me/password", authenticate, validate({ body: passwordSchema }), userController.changePassword);

userRoutes.get("/me/sessions", authenticate, userController.listSessions);

userRoutes.delete("/me/sessions/:sessionId", authenticate, validate({ params: sessionParams }), userController.revokeSession);

userRoutes.get("/me/export", authenticate, userController.exportData);

userRoutes.delete("/me", authenticate, validate({ body: deleteAccountSchema }), userController.deleteAccount);

userRoutes.get("/me/blocks", authenticate, userController.listBlocks);

userRoutes.put("/me/blocks/:id", authenticate, validate({ params: idParams }), userController.blockUser);

userRoutes.delete("/me/blocks/:id", authenticate, validate({ params: idParams }), userController.unblockUser);

userRoutes.get("/:id", validate({ params: idParams }), userController.profile);

userRoutes.get("/:id/reputation", validate({ params: idParams }), userController.publicReputation);

userRoutes.get("/:id/activity", validate({ params: idParams }), userController.activityFeed);

userRoutes.get("/leaderboard/top", userController.leaderboard);

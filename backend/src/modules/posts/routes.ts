import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { communityController } from "../../controllers/community.controller.js";
import { idParams, postSchema } from "./validation.js";

export const postRoutes = Router();

postRoutes.get("/", communityController.listPosts);

postRoutes.post("/", authenticate, validate({ body: postSchema }), communityController.createPost);

postRoutes.get("/:id", validate({ params: idParams }), communityController.getPost);

postRoutes.patch("/:id", authenticate, validate({ params: idParams, body: postSchema.partial() }), communityController.updatePost);

postRoutes.delete("/:id", authenticate, validate({ params: idParams }), communityController.deletePost);

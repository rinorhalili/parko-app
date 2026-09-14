import { Router } from "express";
import multer from "multer";
import { mediaController } from "../controllers/media.controller.js";
import { authenticate } from "../middleware/authenticate.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { files: 1, fileSize: 50 * 1024 * 1024 }, fileFilter: (_req, file, callback) => callback(null, file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) });
export const mediaRoutes = Router();

mediaRoutes.post("/", authenticate, upload.single("file"), mediaController.upload);

mediaRoutes.get("/:key", mediaController.read);

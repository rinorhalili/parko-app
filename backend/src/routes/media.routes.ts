import { Router } from "express";
import multer from "multer";
import { authenticate } from "../middleware/authenticate.js";
import { uploadMedia, readMedia } from "../services/media.service.js";
import { badRequest, notFound } from "../utils/errors.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { files: 1, fileSize: 50 * 1024 * 1024 }, fileFilter: (_req, file, callback) => callback(null, file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) });
export const mediaRoutes = Router();

mediaRoutes.post("/", authenticate, upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) throw badRequest("A single media file is required");
    res.status(201).json({ success: true, data: await uploadMedia(req.file) });
  } catch (error) { next(error); }
});

mediaRoutes.get("/:key", async (req, res, next) => {
  try {
    const object = await readMedia(req.params.key as string);
    if (!object.Body) throw notFound("Media not found");
    res.setHeader("Content-Type", object.ContentType ?? "application/octet-stream");
    res.setHeader("Cache-Control", object.CacheControl ?? "public, max-age=31536000, immutable");
    (object.Body as NodeJS.ReadableStream).pipe(res);
  } catch (error) { next(error); }
});

import type { NextFunction, Request, Response } from "express";
import { uploadMedia, readMedia } from "../services/media.service.js";
import { ok } from "../utils/apiResponse.js";
import { badRequest, notFound } from "../utils/errors.js";

export const mediaController = {
  async upload(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) throw badRequest("A single media file is required");
      ok(res, await uploadMedia(req.file), undefined, 201);
    } catch (error) {
      next(error);
    }
  },
  async read(req: Request, res: Response, next: NextFunction) {
    try {
      const object = await readMedia(req.params.key as string);
      if (!object.Body) throw notFound("Media not found");
      res.setHeader("Content-Type", object.ContentType ?? "application/octet-stream");
      res.setHeader("Cache-Control", object.CacheControl ?? "public, max-age=31536000, immutable");
      (object.Body as NodeJS.ReadableStream).pipe(res);
    } catch (error) {
      next(error);
    }
  }
};

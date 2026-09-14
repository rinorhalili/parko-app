import type { NextFunction, Request, Response } from "express";
import { ok } from "../../utils/apiResponse.js";
import { reactionsService } from "./service.js";

const run = (fn: (req: Request) => Promise<unknown>, status = 200) => async (req: Request, res: Response, next: NextFunction) => {
  try {
    ok(res, await fn(req), undefined, status);
  } catch (error) {
    next(error);
  }
};

export const reactionsController = {
  reactPost: run((req) => reactionsService.reactToPost(req.user!.id, String(req.params.id), req.body.type), 201),
  removePostReaction: run(async (req) => {
    await reactionsService.removePostReaction(req.user!.id, String(req.params.id));
    return { removed: true };
  }),
  reactComment: run((req) => reactionsService.reactToComment(req.user!.id, String(req.params.id), req.body.type), 201),
  removeCommentReaction: run(async (req) => {
    await reactionsService.removeCommentReaction(req.user!.id, String(req.params.id));
    return { removed: true };
  }),
};

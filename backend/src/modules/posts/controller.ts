import type { NextFunction, Request, Response } from "express";
import { ok } from "../../utils/apiResponse.js";
import { postsService } from "./service.js";

const run = (fn: (req: Request) => Promise<unknown>, status = 200) => async (req: Request, res: Response, next: NextFunction) => {
  try {
    ok(res, await fn(req), undefined, status);
  } catch (error) {
    next(error);
  }
};

export const postsController = {
  list: run(() => postsService.list()),
  get: run((req) => postsService.get(String(req.params.id))),
  create: run((req) => postsService.create(req.user!.id, req.body), 201),
  update: run((req) => postsService.update(String(req.params.id), req.user!.id, req.user!.role, req.body)),
  remove: run((req) => postsService.remove(String(req.params.id), req.user!.id, req.user!.role)),
};

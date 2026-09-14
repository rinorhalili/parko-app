import type { NextFunction, Request, Response } from "express";
import { ok } from "../../utils/apiResponse.js";
import { getUserReputation } from "./service.js";

export async function getReputation(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await getUserReputation(String(req.params.userId)));
  } catch (error) {
    next(error);
  }
}

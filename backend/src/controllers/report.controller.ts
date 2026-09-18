import type { NextFunction, Request, Response } from "express";
import {
  createParkingReport,
  listParkingReports,
  voteOnParkingReport,
} from "../modules/reports/service.js";
import { ok } from "../utils/apiResponse.js";
export async function createReport(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    ok(res, await createParkingReport(req.user!.id, req.body), undefined, 201);
  } catch (error) {
    next(error);
  }
}
export async function listReports(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    ok(res, await listParkingReports(req.query as never));
  } catch (error) {
    next(error);
  }
}
export async function voteOnReport(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    ok(
      res,
      await voteOnParkingReport(
        req.user!.id,
        req.params.id as string,
        req.body.vote,
      ),
    );
  } catch (error) {
    next(error);
  }
}

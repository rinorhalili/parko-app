import type { NextFunction, Request, Response } from "express";
import { ok } from "../utils/apiResponse.js";
import * as reservationService from "../modules/reservations/service.js";
export const reservationController = {
  async mine(req: Request, res: Response, next: NextFunction) { try { ok(res, await reservationService.listMyReservations(req.user!.id, req.query as never)); } catch (error) { next(error); } },
  async bySpot(req: Request, res: Response, next: NextFunction) { try { ok(res, await reservationService.listSpotReservations(req.params.parkingSpotId as string)); } catch (error) { next(error); } },
  async create(req: Request, res: Response, next: NextFunction) { try { ok(res, await reservationService.createReservation(req.user!.id, req.body), undefined, 201); } catch (error) { next(error); } },
  async cancel(req: Request, res: Response, next: NextFunction) { try { ok(res, await reservationService.cancelReservation(req.user!.id, String(req.params.id))); } catch (error) { next(error); } }
};

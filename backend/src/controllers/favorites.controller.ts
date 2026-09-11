import type { NextFunction, Request, Response } from "express";
import { favoritesService } from "../services/favorites.service.js";
import { ok } from "../utils/apiResponse.js";
const run = (fn: (req: Request) => Promise<unknown>, status = 200) => async (req: Request, res: Response, next: NextFunction) => { try { ok(res, await fn(req), undefined, status); } catch (error) { next(error); } };
export const favoritesController = {
  list: run((r) => favoritesService.list(r.user!.id)), favoriteParking: run((r) => favoritesService.favoriteParking(r.user!.id, String(r.params.parkingSpotId)), 201), removeParking: run(async (r) => { await favoritesService.removeParking(r.user!.id, String(r.params.parkingSpotId)); return { removed: true }; }),
  favoritePost: run((r) => favoritesService.favoritePost(r.user!.id, String(r.params.postId)), 201), removePost: run(async (r) => { await favoritesService.removePost(r.user!.id, String(r.params.postId)); return { removed: true }; }),
  listAlerts: run((r) => favoritesService.listAlerts(r.user!.id)), subscribeAlert: run((r) => favoritesService.subscribeZone(r.user!.id, r.body.zone), 201), removeAlert: run(async (r) => { await favoritesService.removeAlert(r.user!.id, String(r.params.zone)); return { removed: true }; })
};

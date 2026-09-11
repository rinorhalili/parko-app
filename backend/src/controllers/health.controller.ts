import type { Request, Response } from "express";
import { healthStatus } from "../health/health.service.js";
export async function health(req: Request, res: Response) { const status = await healthStatus(); res.status(status.healthy ? 200 : 503).json({ success: status.healthy, data: status }); }

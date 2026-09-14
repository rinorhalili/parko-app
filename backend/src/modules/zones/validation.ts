import { z } from "zod";

export const zoneParams = z.object({ zone: z.string().trim().min(1).max(80) });

import { z } from "zod";

export const reputationParams = z.object({ userId: z.uuid() });

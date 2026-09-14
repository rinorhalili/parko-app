import cors from "cors";
import { corsOrigins } from "./env.js";

export const corsOptions: cors.CorsOptions = {
  origin: corsOrigins,
  credentials: true,
};

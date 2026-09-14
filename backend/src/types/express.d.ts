import type { TokenUser } from "../utils/tokens.js";

declare global {
  namespace Express {
    interface Request {
      user?: TokenUser;
      id: string;
    }
  }
}

export {};

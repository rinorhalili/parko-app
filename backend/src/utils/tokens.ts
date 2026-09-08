import jwt, { type SignOptions } from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";

export type TokenUser = { id: string; role: "USER" | "MODERATOR" | "ADMIN" };

const sign = (payload: TokenUser, secret: string, expiresIn: string) =>
  jwt.sign(payload, secret, { expiresIn, jwtid: randomUUID() } as SignOptions);

export const signAccessToken = (user: TokenUser) => sign(user, env.JWT_ACCESS_SECRET, env.JWT_ACCESS_EXPIRES_IN);
export const signRefreshToken = (user: TokenUser) => sign(user, env.JWT_REFRESH_SECRET, env.JWT_REFRESH_EXPIRES_IN);

export function verifyAccessToken(token: string): TokenUser {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
  if (typeof decoded === "string" || !decoded.id || !decoded.role) {
    throw new Error("Invalid token");
  }
  return { id: String(decoded.id), role: decoded.role as TokenUser["role"] };
}

import jwt, { type SignOptions } from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";

export type TokenUser = { id: string; role: "USER" | "MODERATOR" | "ADMIN" };

type TokenKind = "access" | "refresh";
type TokenPayload = TokenUser & { kind?: TokenKind };

const sign = (payload: TokenUser, secret: string, expiresIn: string, kind: TokenKind) =>
  jwt.sign({ ...payload, kind }, secret, {
    expiresIn,
    jwtid: randomUUID(),
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  } as SignOptions);

export const signAccessToken = (user: TokenUser) => sign(user, env.JWT_ACCESS_SECRET, env.JWT_ACCESS_EXPIRES_IN, "access");
export const signRefreshToken = (user: TokenUser) => sign(user, env.JWT_REFRESH_SECRET, env.JWT_REFRESH_EXPIRES_IN, "refresh");

function verifyToken(token: string, secret: string, kind: TokenKind): TokenUser {
  const decoded = jwt.verify(token, secret, { issuer: env.JWT_ISSUER, audience: env.JWT_AUDIENCE }) as TokenPayload | string;
  if (typeof decoded === "string" || !decoded.id || !decoded.role || decoded.kind !== kind || !["USER", "MODERATOR", "ADMIN"].includes(decoded.role)) {
    throw new Error("Invalid token");
  }
  return { id: String(decoded.id), role: decoded.role as TokenUser["role"] };
}

export const verifyAccessToken = (token: string) => verifyToken(token, env.JWT_ACCESS_SECRET, "access");
export const verifyRefreshToken = (token: string) => verifyToken(token, env.JWT_REFRESH_SECRET, "refresh");

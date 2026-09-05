import crypto from "node:crypto";
import { Prisma, type Role } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { conflict, unauthorized } from "../../utils/errors.js";
import { hashPassword, verifyPassword } from "../../utils/password.js";
import { signAccessToken, signRefreshToken } from "../../utils/tokens.js";

const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");
const refreshDays = 30;

function publicUser(user: { id: string; name: string; username: string; email: string; role: Role; reputationScore: number; avatar: string | null; bio: string | null; isVerified: boolean }) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role,
    reputationScore: user.reputationScore,
    avatar: user.avatar,
    bio: user.bio,
    isVerified: user.isVerified
  };
}

export async function register(input: { name: string; username: string; email: string; password: string }, meta?: { ip?: string; userAgent?: string }) {
  try {
    const passwordHash = await hashPassword(input.password);
    const user = await prisma.user.create({
      data: { name: input.name, username: input.username, email: input.email.toLowerCase(), passwordHash }
    });
    return issueTokens(user, meta);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw conflict("Email or username already exists");
    }
    throw error;
  }
}

export async function login(input: { email: string; password: string }, meta?: { ip?: string; userAgent?: string }) {
  const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (!user || !user.isActive) throw unauthorized("Invalid credentials");
  const ok = await verifyPassword(user.passwordHash, input.password);
  if (!ok) throw unauthorized("Invalid credentials");
  return issueTokens(user, meta);
}

export async function refresh(refreshToken: string) {
  const session = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(refreshToken) }, include: { user: true } });
  if (!session || session.revokedAt || session.expiresAt <= new Date() || !session.user.isActive) throw unauthorized("Invalid refresh token");
  await prisma.refreshToken.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
  return issueTokens(session.user);
}

export async function logout(refreshToken?: string) {
  if (!refreshToken) return;
  await prisma.refreshToken.updateMany({ where: { tokenHash: hashToken(refreshToken), revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function me(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return publicUser(user);
}

async function issueTokens(user: { id: string; role: Role; name: string; username: string; email: string; reputationScore: number; avatar: string | null; bio: string | null; isVerified: boolean }, meta?: { ip?: string; userAgent?: string }) {
  const tokenUser = { id: user.id, role: user.role };
  const accessToken = signAccessToken(tokenUser);
  const refreshToken = signRefreshToken(tokenUser);
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      ipAddress: meta?.ip,
      userAgent: meta?.userAgent,
      expiresAt: new Date(Date.now() + refreshDays * 24 * 60 * 60 * 1000)
    }
  });
  return { user: publicUser(user), accessToken, refreshToken };
}

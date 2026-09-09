import crypto from "node:crypto";
import { Prisma, type Role } from "@prisma/client";
import { env } from "../../config/env.js";
import { prisma } from "../../database/prisma.js";
import { conflict, serviceUnavailable, unauthorized } from "../../utils/errors.js";
import { hashPassword, verifyPassword } from "../../utils/password.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../utils/tokens.js";
import { deliverPasswordReset, passwordResetDeliveryConfigured } from "./passwordResetDelivery.js";

const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");
const refreshDays = 30;
const passwordResetLifetimeMs = 60 * 60 * 1000;

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

export async function refresh(refreshToken: string, meta?: { ip?: string; userAgent?: string }) {
  let claims: { id: string };
  try {
    claims = verifyRefreshToken(refreshToken);
  } catch {
    throw unauthorized("Invalid refresh token");
  }

  return prisma.$transaction(async (tx) => {
    const session = await tx.refreshToken.findUnique({ where: { tokenHash: hashToken(refreshToken) }, include: { user: true } });
    if (!session || session.userId !== claims.id || session.expiresAt <= new Date() || !session.user.isActive) throw unauthorized("Invalid refresh token");
    if (session.revokedAt) {
      await tx.refreshToken.updateMany({ where: { userId: session.userId, familyId: session.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
      throw unauthorized("Session expired");
    }
    const consumed = await tx.refreshToken.updateMany({ where: { id: session.id, revokedAt: null }, data: { revokedAt: new Date() } });
    if (consumed.count !== 1) throw unauthorized("Refresh token already used");
    return issueTokens(session.user, meta, tx, session.familyId);
  });
}

export async function logout(refreshToken?: string) {
  if (!refreshToken) return;
  await prisma.refreshToken.updateMany({ where: { tokenHash: hashToken(refreshToken), revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function me(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return publicUser(user);
}

export async function requestPasswordReset(email: string) {
  if (!passwordResetDeliveryConfigured()) {
    throw serviceUnavailable("Password reset delivery is not configured");
  }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  // Keep the public response identical for unknown or suspended accounts.
  if (!user || !user.isActive) return;

  const rawToken = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + passwordResetLifetimeMs);
  const resetUrl = new URL(env.PASSWORD_RESET_WEB_URL!);
  resetUrl.searchParams.set("token", rawToken);

  const record = await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
    return tx.passwordResetToken.create({ data: { userId: user.id, tokenHash: hashToken(rawToken), expiresAt } });
  });

  try {
    await deliverPasswordReset({ email: user.email, name: user.name, resetUrl: resetUrl.toString(), expiresAt });
  } catch (error) {
    await prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    throw error;
  }
}

export async function resetPassword(resetToken: string, password: string) {
  return prisma.$transaction(async (tx) => {
    const record = await tx.passwordResetToken.findUnique({ where: { tokenHash: hashToken(resetToken) } });
    if (!record || record.usedAt || record.expiresAt <= new Date()) throw unauthorized("Invalid or expired password reset token");
    const consumed = await tx.passwordResetToken.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: new Date() } });
    if (consumed.count !== 1) throw unauthorized("Invalid or expired password reset token");
    await tx.user.update({ where: { id: record.userId }, data: { passwordHash: await hashPassword(password) } });
    await tx.refreshToken.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.auditLog.create({ data: { actorId: record.userId, action: "auth.password.reset" } });
    return { reset: true };
  });
}

export async function revokeUserSessions(userId: string, db: Prisma.TransactionClient = prisma) {
  await db.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}

async function issueTokens(user: { id: string; role: Role; name: string; username: string; email: string; reputationScore: number; avatar: string | null; bio: string | null; isVerified: boolean }, meta?: { ip?: string; userAgent?: string }, db: Prisma.TransactionClient = prisma, familyId?: string) {
  const tokenUser = { id: user.id, role: user.role };
  const accessToken = signAccessToken(tokenUser);
  const refreshToken = signRefreshToken(tokenUser);
  await db.refreshToken.create({
    data: {
      userId: user.id,
      ...(familyId ? { familyId } : {}),
      tokenHash: hashToken(refreshToken),
      ipAddress: meta?.ip,
      userAgent: meta?.userAgent,
      expiresAt: new Date(Date.now() + refreshDays * 24 * 60 * 60 * 1000)
    }
  });
  return { user: publicUser(user), accessToken, refreshToken };
}

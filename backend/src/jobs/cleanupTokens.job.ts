import { prisma } from "../database/prisma.js";

export async function cleanupTokensJob(now = new Date()) {
  const [refreshTokens, resetTokens, verificationTokens] = await Promise.all([
    prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.emailVerificationToken.deleteMany({ where: { expiresAt: { lt: now } } }),
  ]);
  return {
    refreshTokens: refreshTokens.count,
    resetTokens: resetTokens.count,
    verificationTokens: verificationTokens.count,
  };
}

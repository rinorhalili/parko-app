import { prisma } from "../../database/prisma.js";

export function getCurrentUser(userId: string) {
  return prisma.user.findUniqueOrThrow({ where: { id: userId }, omit: { passwordHash: true } });
}

export function getPublicUser(userId: string) {
  return prisma.user.findUniqueOrThrow({
    where: { id: userId, isActive: true },
    select: { id: true, name: true, username: true, avatar: true, bio: true, role: true, reputationScore: true, isVerified: true, createdAt: true },
  });
}

export function updateCurrentUser(userId: string, input: { name?: string; username?: string; avatar?: string; bio?: string }) {
  return prisma.user.update({ where: { id: userId }, data: input, omit: { passwordHash: true } });
}

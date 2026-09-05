import { prisma } from "../../database/prisma.js";

export async function recordEvent(input: { userId: string; score: number; reason: string; parkingReportId?: string }) {
  return prisma.$transaction(async (tx) => {
    const event = await tx.reputation.create({ data: input });
    await tx.user.update({ where: { id: input.userId }, data: { reputationScore: { increment: input.score } } });
    return event;
  });
}

export async function getUserReputation(userId: string) {
  const [user, events] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, reputationScore: true } }),
    prisma.reputation.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 })
  ]);
  return { score: user.reputationScore, events };
}

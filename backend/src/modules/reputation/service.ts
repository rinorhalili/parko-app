import { prisma } from "../../database/prisma.js";

const badgeThresholds = [
  { code: "FIRST_REPORT", minimum: 1 },
  { code: "LOCAL_GUIDE", minimum: 25 },
  { code: "PARKING_EXPERT", minimum: 100 },
  { code: "CITY_CHAMPION", minimum: 500 }
] as const;

export function levelForScore(score: number) {
  if (score >= 500) return { level: 5, label: "City Champion" };
  if (score >= 100) return { level: 4, label: "Parking Expert" };
  if (score >= 25) return { level: 3, label: "Local Guide" };
  if (score >= 5) return { level: 2, label: "Contributor" };
  return { level: 1, label: "New Driver" };
}

export async function recordEvent(input: { userId: string; score: number; reason: string; parkingReportId?: string }) {
  return prisma.$transaction(async (tx) => {
    const event = await tx.reputation.create({ data: input });
    const user = await tx.user.update({ where: { id: input.userId }, data: { reputationScore: { increment: input.score } }, select: { reputationScore: true } });
    for (const badge of badgeThresholds.filter((item) => user.reputationScore >= item.minimum)) {
      await tx.userBadge.upsert({ where: { userId_code: { userId: input.userId, code: badge.code } }, create: { userId: input.userId, code: badge.code }, update: {} });
    }
    return event;
  });
}

export async function getUserReputation(userId: string) {
  const [user, events, badges] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, reputationScore: true } }),
    prisma.reputation.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.userBadge.findMany({ where: { userId }, select: { code: true, awardedAt: true }, orderBy: { awardedAt: "desc" } })
  ]);
  return { score: user.reputationScore, level: levelForScore(user.reputationScore), badges, events };
}

import type { Prisma } from "@prisma/client";
import { prisma } from "../database/prisma.js";

const publicUser = { id: true, name: true, username: true, avatar: true, bio: true, reputationScore: true, isVerified: true } as const;
export class UserRepository {
  me(id: string) { return prisma.user.findUniqueOrThrow({ where: { id }, omit: { passwordHash: true } }); }
  publicProfile(id: string) { return prisma.user.findUniqueOrThrow({ where: { id }, select: publicUser }); }
  updateProfile(id: string, data: Prisma.UserUpdateInput) { return prisma.user.update({ where: { id }, data, omit: { passwordHash: true } }); }
}
export const userRepository = new UserRepository();

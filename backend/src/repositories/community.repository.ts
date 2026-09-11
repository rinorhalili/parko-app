import type { Prisma, ReactionType } from "@prisma/client";
import { prisma } from "../database/prisma.js";

export class CommunityRepository {
  listPosts() { return prisma.post.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 50, include: { author: { select: { id: true, username: true, reputationScore: true } }, _count: { select: { comments: true, reactions: true } } } }); }
  findPost(id: string) { return prisma.post.findUnique({ where: { id } }); }
  findPublicPost(id: string) { return prisma.post.findFirst({ where: { id, deletedAt: null }, include: { comments: true, reactions: true } }); }
  existsPublicPost(id: string) { return prisma.post.findFirst({ where: { id, deletedAt: null }, select: { id: true } }); }
  createPost(data: Prisma.PostUncheckedCreateInput) { return prisma.post.create({ data }); }
  updatePost(id: string, data: Prisma.PostUpdateInput) { return prisma.post.update({ where: { id }, data }); }
  listComments(postId: string) { return prisma.comment.findMany({ where: { postId, deletedAt: null }, orderBy: { createdAt: "asc" }, include: { author: { select: { id: true, username: true } }, reactions: true } }); }
  findComment(id: string) { return prisma.comment.findUnique({ where: { id } }); }
  createComment(data: Prisma.CommentUncheckedCreateInput) { return prisma.comment.create({ data }); }
  updateComment(id: string, data: Prisma.CommentUpdateInput) { return prisma.comment.update({ where: { id }, data }); }
  reactToPost(userId: string, postId: string, type: ReactionType) { return prisma.reaction.upsert({ where: { userId_postId: { userId, postId } }, create: { userId, postId, type }, update: { type } }); }
  removePostReaction(userId: string, postId: string) { return prisma.reaction.deleteMany({ where: { userId, postId } }); }
  reactToComment(userId: string, commentId: string, type: ReactionType) { return prisma.reaction.upsert({ where: { userId_commentId: { userId, commentId } }, create: { userId, commentId, type }, update: { type } }); }
  removeCommentReaction(userId: string, commentId: string) { return prisma.reaction.deleteMany({ where: { userId, commentId } }); }
}
export const communityRepository = new CommunityRepository();

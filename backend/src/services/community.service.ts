import type { Prisma, Role } from "@prisma/client";
import { communityRepository } from "../repositories/community.repository.js";
import { forbidden, notFound } from "../utils/errors.js";
import { createNotification } from "../modules/notifications/service.js";
import { emitRealtime } from "../websocket/io.js";

const mayManage = (authorId: string, actorId: string, role: Role) => authorId === actorId || role !== "USER";
export class CommunityService {
  listPosts() { return communityRepository.listPosts(); }
  async getPost(id: string) { const post = await communityRepository.findPublicPost(id); if (!post) throw notFound("Post not found"); return post; }
  async createPost(authorId: string, input: { title: string; content: string; parkingSpotId?: string; latitude?: number; longitude?: number; media?: Prisma.InputJsonValue }) {
    const post = await communityRepository.createPost({ ...input, authorId }); emitRealtime("community:post.created", post, "community"); emitRealtime("post:new", post, "community"); return post;
  }
  async updatePost(id: string, actorId: string, role: Role, input: { title?: string; content?: string; parkingSpotId?: string; latitude?: number; longitude?: number; media?: Prisma.InputJsonValue }) {
    const post = await communityRepository.findPost(id); if (!post) throw notFound("Post not found"); if (!mayManage(post.authorId, actorId, role)) throw forbidden();
    return communityRepository.updatePost(id, input);
  }
  async deletePost(id: string, actorId: string, role: Role) { return this.updatePost(id, actorId, role, { deletedAt: new Date() } as never); }
  listComments(postId: string) { return communityRepository.listComments(postId); }
  async createComment(postId: string, authorId: string, input: { content: string; parentCommentId?: string }) {
    const post = await communityRepository.findPost(postId); if (!post || post.deletedAt) throw notFound("Post not found");
    const comment = await communityRepository.createComment({ ...input, postId, authorId });
    if (post.authorId !== authorId) await createNotification({ recipientId: post.authorId, type: "COMMENT", title: "New comment", message: "Someone commented on your post", data: { postId, commentId: comment.id } });
    emitRealtime("community:comment.created", comment, "community"); emitRealtime("comment:new", comment, "community"); return comment;
  }
  async updateComment(id: string, actorId: string, role: Role, content: string) { const comment = await communityRepository.findComment(id); if (!comment) throw notFound("Comment not found"); if (!mayManage(comment.authorId, actorId, role)) throw forbidden(); return communityRepository.updateComment(id, { content }); }
  async deleteComment(id: string, actorId: string, role: Role) { const comment = await communityRepository.findComment(id); if (!comment) throw notFound("Comment not found"); if (!mayManage(comment.authorId, actorId, role)) throw forbidden(); return communityRepository.updateComment(id, { deletedAt: new Date() }); }
  reactToPost(userId: string, postId: string, type: "LIKE" | "HELPFUL" | "THANKS") { return communityRepository.reactToPost(userId, postId, type); }
  removePostReaction(userId: string, postId: string) { return communityRepository.removePostReaction(userId, postId); }
  reactToComment(userId: string, commentId: string, type: "LIKE" | "HELPFUL" | "THANKS") { return communityRepository.reactToComment(userId, commentId, type); }
  removeCommentReaction(userId: string, commentId: string) { return communityRepository.removeCommentReaction(userId, commentId); }
}
export const communityService = new CommunityService();

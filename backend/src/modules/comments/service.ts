import type { Role } from "@prisma/client";
import { communityService } from "../../services/community.service.js";

export const commentsService = {
  list(postId: string) {
    return communityService.listComments(postId);
  },
  create(postId: string, authorId: string, input: { content: string; parentCommentId?: string }) {
    return communityService.createComment(postId, authorId, input);
  },
  update(id: string, actorId: string, role: Role, content: string) {
    return communityService.updateComment(id, actorId, role, content);
  },
  remove(id: string, actorId: string, role: Role) {
    return communityService.deleteComment(id, actorId, role);
  },
};

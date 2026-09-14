import { communityService } from "../../services/community.service.js";

export type ReactionInput = "LIKE" | "HELPFUL" | "THANKS";

export const reactionsService = {
  reactToPost(userId: string, postId: string, type: ReactionInput) {
    return communityService.reactToPost(userId, postId, type);
  },
  removePostReaction(userId: string, postId: string) {
    return communityService.removePostReaction(userId, postId);
  },
  reactToComment(userId: string, commentId: string, type: ReactionInput) {
    return communityService.reactToComment(userId, commentId, type);
  },
  removeCommentReaction(userId: string, commentId: string) {
    return communityService.removeCommentReaction(userId, commentId);
  },
};

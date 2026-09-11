import type { NextFunction, Request, Response } from "express";
import { communityService } from "../services/community.service.js";
import { ok } from "../utils/apiResponse.js";
const run = (fn: (req: Request) => Promise<unknown>, status = 200) => async (req: Request, res: Response, next: NextFunction) => { try { ok(res, await fn(req), undefined, status); } catch (error) { next(error); } };
export const communityController = {
  listPosts: run(() => communityService.listPosts()), getPost: run((r) => communityService.getPost(String(r.params.id))), createPost: run((r) => communityService.createPost(r.user!.id, r.body), 201),
  updatePost: run((r) => communityService.updatePost(String(r.params.id), r.user!.id, r.user!.role, r.body)), deletePost: run((r) => communityService.deletePost(String(r.params.id), r.user!.id, r.user!.role)),
  listComments: run((r) => communityService.listComments(String(r.params.postId))), createComment: run((r) => communityService.createComment(String(r.params.postId), r.user!.id, r.body), 201),
  updateComment: run((r) => communityService.updateComment(String(r.params.id), r.user!.id, r.user!.role, r.body.content)), deleteComment: run((r) => communityService.deleteComment(String(r.params.id), r.user!.id, r.user!.role)),
  reactPost: run((r) => communityService.reactToPost(r.user!.id, String(r.params.id), r.body.type), 201), removePostReaction: run(async (r) => { await communityService.removePostReaction(r.user!.id, String(r.params.id)); return { removed: true }; }),
  reactComment: run((r) => communityService.reactToComment(r.user!.id, String(r.params.id), r.body.type), 201), removeCommentReaction: run(async (r) => { await communityService.removeCommentReaction(r.user!.id, String(r.params.id)); return { removed: true }; })
};

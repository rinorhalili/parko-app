import { z } from "zod";

export const postIdParams = z.object({ postId: z.uuid() });
export const idParams = z.object({ id: z.uuid() });
export const commentSchema = z.object({
  content: z.string().min(1).max(2000),
  parentCommentId: z.uuid().optional()
});

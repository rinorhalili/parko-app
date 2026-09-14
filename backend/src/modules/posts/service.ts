import type { Prisma, Role } from "@prisma/client";
import { communityService } from "../../services/community.service.js";

export const postsService = {
  list() {
    return communityService.listPosts();
  },
  get(id: string) {
    return communityService.getPost(id);
  },
  create(authorId: string, input: { title: string; content: string; parkingSpotId?: string; latitude?: number; longitude?: number; media?: Prisma.InputJsonValue }) {
    return communityService.createPost(authorId, input);
  },
  update(id: string, actorId: string, role: Role, input: { title?: string; content?: string; parkingSpotId?: string; latitude?: number; longitude?: number; media?: Prisma.InputJsonValue }) {
    return communityService.updatePost(id, actorId, role, input);
  },
  remove(id: string, actorId: string, role: Role) {
    return communityService.deletePost(id, actorId, role);
  },
};

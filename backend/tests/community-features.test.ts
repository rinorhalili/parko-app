import { beforeEach, describe, expect, it, vi } from "vitest";
import { parkingReportSchema } from "../src/modules/reports/validation.js";
import { postSchema } from "../src/modules/posts/validation.js";

const db = vi.hoisted(() => ({
  parkingSpot: { findUnique: vi.fn() },
  post: { findFirst: vi.fn() },
  favoriteParking: { upsert: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
  favoritePost: { upsert: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
  zoneAlert: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn(), updateMany: vi.fn() }
}));
vi.mock("../src/database/prisma.js", () => ({ prisma: db }));

import { favoritesService } from "../src/services/favorites.service.js";

const image = "data:image/jpeg;base64,SGVsbG8=";

describe("community attachments", () => {
  it("accepts compact JPEG attachments and rejects unsafe media URLs", () => {
    expect(postSchema.safeParse({ title: "Parking update", content: "There are spaces", media: [{ url: image, type: "image" }] }).success).toBe(true);
    expect(parkingReportSchema.safeParse({ parkingSpotId: "spot-1", status: "AVAILABLE", latitude: 42.66, longitude: 21.16, media: [{ url: "javascript:alert(1)", type: "image" }] }).success).toBe(false);
  });
});

describe("favorites service", () => {
  beforeEach(() => vi.resetAllMocks());

  it("only stores a favorite after its parking location exists", async () => {
    db.parkingSpot.findUnique.mockResolvedValue({ id: "spot-1" });
    db.favoriteParking.upsert.mockResolvedValue({ userId: "user-1", parkingSpotId: "spot-1" });
    await expect(favoritesService.favoriteParking("user-1", "spot-1")).resolves.toMatchObject({ parkingSpotId: "spot-1" });
    expect(db.favoriteParking.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { userId_parkingSpotId: { userId: "user-1", parkingSpotId: "spot-1" } } }));
  });

  it("returns saved post and parking identifiers without loading full records", async () => {
    db.favoriteParking.findMany.mockResolvedValue([{ parkingSpotId: "spot-1" }]);
    db.favoritePost.findMany.mockResolvedValue([{ postId: "post-1" }]);
    await expect(favoritesService.list("user-1")).resolves.toEqual({ parkingIds: ["spot-1"], postIds: ["post-1"] });
  });
});

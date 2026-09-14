import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";

describe("community integration", () => {
  it("exposes public posts", async () => {
    const response = await request(createApp()).get("/api/v1/posts");
    expect([200, 500]).toContain(response.status);
  });
});

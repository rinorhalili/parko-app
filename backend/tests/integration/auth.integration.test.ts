import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";

describe("auth integration", () => {
  it("rejects unauthenticated profile access", async () => {
    const response = await request(createApp()).get("/api/v1/users/me");
    expect(response.status).toBe(401);
  });
});

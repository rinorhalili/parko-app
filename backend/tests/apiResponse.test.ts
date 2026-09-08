import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import request from "supertest";

describe("API shell", () => {
  it("returns health status", async () => {
    const response = await request(createApp()).get("/health").expect(200);
    expect(response.body).toEqual({ ok: true });
  });

  it("validates auth input", async () => {
    const response = await request(createApp()).post("/api/v1/auth/register").send({ email: "bad" }).expect(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("does not expose admin parking data without a valid access token", async () => {
    const response = await request(createApp()).get("/api/v1/admin/parking").expect(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("adds baseline browser security headers", async () => {
    const response = await request(createApp()).get("/health").expect(200);
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["content-security-policy"]).toContain("default-src 'self'");
  });
});

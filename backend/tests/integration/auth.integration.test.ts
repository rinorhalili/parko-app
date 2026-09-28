import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";

describe("auth integration", () => {
  it("rejects unauthenticated profile access", async () => {
    const response = await request(createApp()).get("/api/v1/users/me");
    expect(response.status).toBe(401);
  });

  it("validates Google sign-in credentials before attempting provider verification", async () => {
    const response = await request(createApp())
      .post("/api/v1/auth/google")
      .send({ credential: "", intent: "login" });

    expect(response.status).toBe(400);
  });

  it("rejects an unsupported Google sign-in intent", async () => {
    const response = await request(createApp())
      .post("/api/v1/auth/google")
      .send({ credential: "not-a-token", intent: "delete" });

    expect(response.status).toBe(400);
  });
});

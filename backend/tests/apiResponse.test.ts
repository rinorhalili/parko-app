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
});

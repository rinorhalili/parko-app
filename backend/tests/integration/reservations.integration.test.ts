import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";

describe("reservations integration", () => {
  it("requires authentication for my reservations", async () => {
    const response = await request(createApp()).get("/api/v1/reservations/me");
    expect(response.status).toBe(401);
  });
});

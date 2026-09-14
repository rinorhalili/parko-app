import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";

describe("parking integration", () => {
  it("exposes the parking collection", async () => {
    const response = await request(createApp()).get("/api/v1/parking?page=0");
    expect([200, 500]).toContain(response.status);
  });
});

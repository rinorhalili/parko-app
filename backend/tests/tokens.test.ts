import { describe, expect, it } from "vitest";
import { signAccessToken, verifyAccessToken } from "../src/utils/tokens.js";

describe("JWT access tokens", () => {
  it("round-trips authenticated user claims", () => {
    const token = signAccessToken({ id: "user-1", role: "MODERATOR" });
    expect(verifyAccessToken(token)).toEqual({ id: "user-1", role: "MODERATOR" });
  });
});

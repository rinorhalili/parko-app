import { describe, expect, it } from "vitest";
import { levelForScore } from "../src/modules/reputation/service.js";

describe("reputation levels", () => {
  it("assigns stable levels at every public threshold", () => {
    expect(levelForScore(0)).toEqual({ level: 1, label: "New Driver" });
    expect(levelForScore(5)).toEqual({ level: 2, label: "Contributor" });
    expect(levelForScore(25)).toEqual({ level: 3, label: "Local Guide" });
    expect(levelForScore(100)).toEqual({ level: 4, label: "Parking Expert" });
    expect(levelForScore(500)).toEqual({ level: 5, label: "City Champion" });
  });
});

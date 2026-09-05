import { describe, expect, it } from "vitest";
import { haversineMeters } from "../src/modules/parking/service.js";

describe("parking distance helpers", () => {
  it("calculates realistic walking-scale distances", () => {
    const meters = haversineMeters({ lat: 42.6629, lng: 21.1655 }, { lat: 42.6635, lng: 21.1665 });
    expect(meters).toBeGreaterThan(90);
    expect(meters).toBeLessThan(120);
  });
});

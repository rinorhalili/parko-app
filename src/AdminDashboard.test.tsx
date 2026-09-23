import { describe, expect, it } from "vitest";
import { formatPrice } from "./AdminDashboard";

describe("admin dashboard price formatting", () => {
  it("treats undefined prices as unknown instead of crashing", () => {
    expect(formatPrice(undefined)).toBe("Çmimi i panjohur");
    expect(formatPrice(null)).toBe("Çmimi i panjohur");
    expect(formatPrice(0)).toBe("Falas");
    expect(formatPrice(2.5)).toBe("2.50 €/orë");
  });
});

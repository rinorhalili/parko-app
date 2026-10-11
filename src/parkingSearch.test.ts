import { describe, expect, it } from "vitest";
import { defaultParking } from "./testFixtures";
import { searchParkingDestinations } from "./parkingSearch";

describe("parking search destinations", () => {
  it("returns matching parking as a mappable destination", () => {
    const parking = {
      ...defaultParking,
      id: "parking-qafa",
      name: "Parking Qafa",
      address: "Rruga UÇK, Prishtinë",
      zone: "Qendra",
      coordinates: { lat: 42.6659, lng: 21.1622 },
    };

    expect(searchParkingDestinations([parking], "parking qafa")).toEqual([
      expect.objectContaining({
        id: "parking-parking-qafa",
        name: "Parking Qafa",
        category: "place",
        coordinates: parking.coordinates,
        source: "map",
      }),
    ]);
  });

  it("matches Albanian diacritics and rejects short or unrelated queries", () => {
    const parking = {
      ...defaultParking,
      name: "Parking Qafa",
      address: "Rruga UÇK, Prishtinë",
      zone: "Qendra",
    };
    expect(searchParkingDestinations([parking], "rruga uck")).toHaveLength(1);
    expect(searchParkingDestinations([parking], "p")).toEqual([]);
    expect(searchParkingDestinations([parking], "aeroporti")).toEqual([]);
  });
});

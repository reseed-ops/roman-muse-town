// Task 90: the walkthrough's place list is built from the town's data and covers every place the brief names.
import { describe, expect, test } from "bun:test";
import { buildTourPlaces, TOUR_REQUIRED, type TourData } from "./tourPlaces";
import { CLIFF } from "./seaCliff";
import { ATHENA_SEAT, PLACES } from "./town";

// What the scene hands over (TownSceneHandle.tourData): a few of its real seats and anchors.
const DATA: TourData = {
  seats: [
    { id: "bench-athena", x: ATHENA_SEAT.x, z: ATHENA_SEAT.z, rotY: ATHENA_SEAT.rotY },
    { id: CLIFF.bench.id, x: CLIFF.bench.x, z: CLIFF.bench.z, rotY: CLIFF.bench.rotY },
  ],
  anchors: { tree: [3.6, 4.2], forum: [0, 15], lakeshore: [-9.7, -29.9], stories: [-12.6, -12.4], market: [6.2, 35.2], boat: [-9.9, -31.05], bath: [24, 26.6], gate: [0, 41.5], sounds: [-14, 2.2], piscina: [-11.5, 25.6] },
};

describe("tour place list", () => {
  const places = buildTourPlaces(DATA);
  const ids = places.map((p) => p.id);

  test("covers every place the brief names", () => {
    for (const id of TOUR_REQUIRED) expect(ids).toContain(id);
  });
  test("has one entry per house in PLACES", () => {
    for (const p of PLACES) expect(ids).toContain(p.id);
  });
  test("ids are unique and every pose is finite", () => {
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of places) for (const v of [p.x, p.z, p.heading]) expect(Number.isFinite(v)).toBe(true);
  });
  test("picks up a new seat and a new anchor without an edit", () => {
    const more = buildTourPlaces({ seats: [...DATA.seats, { id: "bench-new", x: 1, z: 2, rotY: 0 }], anchors: { ...DATA.anchors, newplace: [5, 5] } });
    expect(more.map((p) => p.id)).toContain("bench-new");
    expect(more.map((p) => p.id)).toContain("newplace");
  });
  test("a seat's view faces the way the seat faces", () => {
    const c = places.find((p) => p.id === "bench-athena")!;
    expect(Math.sin(c.heading)).toBeCloseTo(1, 5); // east, toward Lucretia
    const cliff = places.find((p) => p.id === "bench-cliff")!;
    expect(Math.cos(cliff.heading)).toBeCloseTo(1, 5); // south, to the sea
  });
});

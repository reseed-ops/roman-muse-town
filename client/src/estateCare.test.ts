import { expect, test } from "bun:test";
import { careKey, ESTATE_AREAS, estateCare, weedStands, type CareFacts } from "./estateCare";

const fresh: CareFacts = { waterings: 0, harvests: 0, questsDone: 0, found: 0, inscriptions: 0, rank: 0, dishes: 0, upgrades: [], sharedBath: false };

test("a new estate has no care yet", () => {
  expect(Object.values(estateCare(fresh)).every((v) => v === 0)).toBe(true);
});

test("everything done is everything kept, and no more", () => {
  const done: CareFacts = { waterings: 99, harvests: 99, questsDone: 99, found: 99, inscriptions: 99, rank: 99, dishes: 99, upgrades: ["lanterns", "fountain", "planters", "cobbles"], sharedBath: true };
  for (const area of ESTATE_AREAS) expect(estateCare(done)[area]).toBeCloseTo(1);
});

test("each area answers to its own work", () => {
  const care = estateCare({ ...fresh, waterings: 5 });
  expect(care.peristyle).toBeCloseTo(0.3);
  expect(care.avenue).toBe(0);
  expect(estateCare({ ...fresh, upgrades: ["fountain"] }).forecourt).toBeCloseTo(0.6);
  expect(estateCare({ ...fresh, harvests: 2, dishes: 5 }).kitchen).toBeCloseTo(0.7);
  expect(estateCare({ ...fresh, sharedBath: true }).baths).toBeCloseTo(0.5);
});

test("care never falls as more is done", () => {
  let last = estateCare(fresh);
  for (let n = 1; n < 12; n++) {
    const next = estateCare({ ...fresh, waterings: n, questsDone: n, rank: n });
    for (const area of ESTATE_AREAS) expect(next[area]).toBeGreaterThanOrEqual(last[area]);
    last = next;
  }
});

test("the key only moves when the scene could show it", () => {
  expect(careKey(estateCare({ ...fresh, waterings: 5 }))).toBe(careKey(estateCare({ ...fresh, waterings: 5 })));
  expect(careKey(estateCare({ ...fresh, waterings: 1 }))).not.toBe(careKey(estateCare(fresh)));
});

test("weeds clear at their own thresholds", () => {
  expect(weedStands(0.2, 0.5)).toBe(true);
  expect(weedStands(0.5, 0.5)).toBe(false);
});

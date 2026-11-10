import { expect, test } from "bun:test";
import { CLIFF, onLand } from "./seaCliff";
import { FISHING_BOAT_LENGTH, FISHING_SPOTS, fishingOut, nextGap, pickFishingSpots, pickLivery, pickSailDye, pickShip, planVoyage, SAIL_DYES, SHIPS, shipsSail, TRIREME_CHANCE, voyagePose, watchingSea } from "./seaShips";

// The ships on the sea (Task 50), pinned off the scene.

const fixed = (n: number) => () => n;
const bench = { x: CLIFF.bench.x, z: CLIFF.bench.z };

test("about 3 in 4 a trade ship, about 1 in 4 a trireme", () => {
  let triremes = 0;
  const n = 1000;
  for (let i = 0; i < n; i++) if (pickShip((i + 0.5) / n) === "trireme") triremes += 1;
  expect(triremes / n).toBeCloseTo(TRIREME_CHANCE, 2);
  expect(TRIREME_CHANCE).toBeGreaterThan(0.15);
  expect(TRIREME_CHANCE).toBeLessThan(0.35);
});

test("the trireme passes farther out and slower, both in metres and as seen from the bench", () => {
  const trade = planVoyage("trade", true, fixed(0.5));
  const tri = planVoyage("trireme", true, fixed(0.5));
  expect(tri.laneZ - bench.z).toBeGreaterThan(trade.laneZ - bench.z + 40);
  expect(SHIPS.trireme.speed).toBeLessThan(SHIPS.trade.speed);
  // Angular speed across the view at the lane's middle: the trireme crawls.
  const ang = (kind: "trade" | "trireme", laneZ: number) => SHIPS[kind].speed / (laneZ - bench.z);
  expect(ang("trireme", tri.laneZ)).toBeLessThan(ang("trade", trade.laneZ) * 0.5);
  expect(tri.duration).toBeGreaterThan(trade.duration);
});

test("a pass takes minutes, and its lane stays on open water inside the clear-weather haze", () => {
  for (const kind of ["trade", "trireme"] as const) {
    for (const r of [0, 1]) {
      const v = planVoyage(kind, r > 0.5, fixed(r));
      expect(v.duration).toBeGreaterThan(150);
      expect(v.duration).toBeLessThan(480);
      for (let i = 0; i <= 20; i++) {
        const p = voyagePose(v, i / 20);
        // Never over the peninsula's land, and clear of the cliff's foot.
        expect(onLand(p.x, p.z)).toBe(false);
        expect(p.z).toBeGreaterThan(CLIFF.head.z + CLIFF.head.r + 25);
      }
      // At its nearest the ship is in front of the fog's far wall (235 m clear weather).
      const mid = voyagePose(v, 0.5);
      expect(Math.hypot(mid.x - bench.x, mid.z - bench.z)).toBeLessThan(150);
      // Its ends lie out in the haze, so it sails in and out of sight.
      const end = voyagePose(v, 0);
      expect(Math.hypot(end.x - bench.x, end.z - bench.z)).toBeGreaterThan(150);
    }
  }
});

test("east in the morning, west after noon, the bow along the course", () => {
  const am = planVoyage("trade", true, fixed(0.5));
  const pm = planVoyage("trade", false, fixed(0.5));
  expect(voyagePose(am, 0).x).toBeLessThan(voyagePose(am, 1).x);
  expect(voyagePose(pm, 0).x).toBeGreaterThan(voyagePose(pm, 1).x);
  for (const v of [am, pm]) {
    for (const p of [0.1, 0.5, 0.9]) {
      const a = voyagePose(v, p);
      const b = voyagePose(v, p + 0.001);
      const h = a.heading;
      // rotation.y = h turns the model's +X bow to (cos h, -sin h) in (x, z).
      const bow = { x: Math.cos(h), z: -Math.sin(h) };
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      expect((bow.x * (b.x - a.x) + bow.z * (b.z - a.z)) / len).toBeGreaterThan(0.999);
    }
  }
});

test("a pass can begin part way, already in view", () => {
  const v = planVoyage("trade", true, fixed(0.5), 0.3);
  expect(v.elapsed / v.duration).toBeCloseTo(0.3);
});

test("no ships in a storm or a fog bank; longer quiet at night", () => {
  expect(shipsSail({ nightMix: 0, storm: false, fog: false })).toBe(true);
  expect(shipsSail({ nightMix: 0, storm: true, fog: false })).toBe(false);
  expect(shipsSail({ nightMix: 0, storm: false, fog: true })).toBe(false);
  const day = nextGap({ nightMix: 0, storm: false, fog: false }, 0.5);
  const night = nextGap({ nightMix: 1, storm: false, fog: false }, 0.5);
  expect(day).toBeGreaterThan(20);
  expect(day).toBeLessThan(90);
  expect(night).toBeCloseTo(day * 2);
});

test("the sea is watched only from the peninsula", () => {
  expect(watchingSea(0)).toBe(false);
  expect(watchingSea(30)).toBe(false);
  expect(watchingSea(80)).toBe(true);
  expect(watchingSea(CLIFF.bench.z)).toBe(true);
});

test("passes vary: the trade ship's sail is dyed by chance, undyed most often; the trireme has two liveries", () => {
  const dyes = new Map<number, number>();
  for (let i = 0; i < 1000; i++) {
    const d = pickSailDye((i + 0.5) / 1000);
    dyes.set(d, (dyes.get(d) ?? 0) + 1);
  }
  expect(dyes.size).toBe(new Set(SAIL_DYES).size);
  const undyed = dyes.get(0xffffff)!;
  for (const [d, n] of dyes) if (d !== 0xffffff) expect(undyed).toBeGreaterThan(n);
  expect(pickLivery(0.1)).toBe("striped");
  expect(pickLivery(0.9)).toBe("plain");
  const v = planVoyage("trireme", true, fixed(0.9));
  expect(v.livery).toBe("plain");
});

test("fishing boats ride at anchor below the headland, on open water, inside the ships' lanes", () => {
  const nearestLane = Math.min(...(["trade", "trireme"] as const).map((k) => {
    const lo = planVoyage(k, true, fixed(0));
    return lo.laneZ - SHIPS[k].arc;
  }));
  for (const [x, z] of FISHING_SPOTS) {
    // Swinging about the anchor, the whole boat stays off the land.
    for (let a = 0; a < 8; a++) {
      const r = FISHING_BOAT_LENGTH;
      expect(onLand(x + Math.cos(a) * r, z + Math.sin(a) * r)).toBe(false);
    }
    expect(Math.hypot(x - CLIFF.head.x, z - CLIFF.head.z)).toBeGreaterThan(CLIFF.head.r + 6);
    expect(Math.hypot(x - bench.x, z - bench.z)).toBeLessThan(50);
    expect(z + FISHING_BOAT_LENGTH).toBeLessThan(nearestLane - 4);
  }
});

test("one or two fishing boats, at different spots, by day only", () => {
  const seq = (...n: number[]) => { let i = 0; return () => n[i++ % n.length]!; };
  expect(pickFishingSpots(seq(0.1, 0.5)).length).toBe(1);
  const two = pickFishingSpots(seq(0.9, 0.0, 0.99));
  expect(two.length).toBe(2);
  expect(two[0]).not.toEqual(two[1]);
  expect(fishingOut({ nightMix: 0, storm: false, fog: false })).toBe(true);
  expect(fishingOut({ nightMix: 0.9, storm: false, fog: false })).toBe(false);
  expect(fishingOut({ nightMix: 0, storm: true, fog: false })).toBe(false);
});

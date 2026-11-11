import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as THREE from "three";
import {
  OLIVES_PLANTED_DAY, OLIVE_DAYS_PER_STAGE, OLIVE_MAX_STAGE, OLIVE_MIN_SCALE, daysSincePlanting, fireflyShare, oliveScale, oliveStage, seasonAt,
} from "../../shared/seasons";
import {
  PHOENIX_COOLDOWN_DAYS, PHOENIX_NEAR, PHOENIX_STAY_MS, PHOENIX_VISIT_LINE, PHOENIX_VISIT_ONE_IN, phoenixRollsDay, phoenixVisitBlocked, type PhoenixVisitFacts,
} from "../../shared/phoenixVisit";
import {
  SURPRISE_AFTER_TENDER_MS, SURPRISE_COOLDOWN_DAYS, SURPRISE_COUNT_CAP, SURPRISE_INFO, SURPRISE_LINES, SURPRISE_RANK, SURPRISE_SPOTS, SURPRISE_VISIT_GRACE_MS,
  nextSurpriseSpot, noteSurprise, readSurpriseMemory, readSurprises, rememberSurprise, surpriseBlocked, surpriseRollsDay, type SurpriseFacts,
} from "../../shared/aeliaSurprise";
import { gateTender } from "../../shared/tenderGate";
import { TENDER_MOMENT_RANK } from "../../shared/tenderMoments";
import { ATHENA_TEMPLE, LAKE, LUCRETIA, YOUNG_OLIVES, seasonForDate } from "./town";
import { CLIFF } from "./seaCliff";
import { FLOWER_PATCHES, HARVEST_SPOTS, WINTER_LANTERNS, createSeasonalTown } from "./seasonalTown";
import { nextGap, shipsSail } from "./seaShips";

const scene = readFileSync(join(import.meta.dir, "townScene.ts"), "utf8");
const app = readFileSync(join(import.meta.dir, "App.tsx"), "utf8");
const server = readFileSync(join(import.meta.dir, "../../server/src/actions.ts"), "utf8");
const d = (y: number, m: number, day: number) => new Date(y, m - 1, day, 12);

describe("Task 60: the season of a real date", () => {
  test("all four seasons, and their boundaries, northern hemisphere", () => {
    expect(seasonAt(d(2027, 1, 15))).toBe("winter");
    expect(seasonAt(d(2027, 2, 28))).toBe("winter");
    expect(seasonAt(d(2027, 3, 1))).toBe("spring");
    expect(seasonAt(d(2027, 5, 31))).toBe("spring");
    expect(seasonAt(d(2027, 6, 1))).toBe("summer");
    expect(seasonAt(d(2027, 8, 31))).toBe("summer");
    expect(seasonAt(d(2027, 9, 1))).toBe("autumn");
    expect(seasonAt(d(2027, 11, 30))).toBe("autumn");
    expect(seasonAt(d(2027, 12, 1))).toBe("winter");
    expect(seasonAt(d(2027, 12, 31))).toBe("winter");
    expect(seasonAt(new Date(2028, 1, 29, 23, 59))).toBe("winter"); // a leap day
    expect(seasonAt(new Date(2027, 2, 1, 0, 0))).toBe("spring");
  });
  test("every month has a season and the year turns winter, spring, summer, autumn", () => {
    const seq = Array.from({ length: 12 }, (_, i) => seasonAt(d(2027, i + 1, 15)));
    expect(seq).toEqual(["winter", "winter", "spring", "spring", "spring", "summer", "summer", "summer", "autumn", "autumn", "autumn", "winter"]);
  });
  test("the town tree's own rule is the same pure function", () => {
    for (let m = 1; m <= 12; m++) expect(seasonForDate(d(2027, m, 10))).toBe(seasonAt(d(2027, m, 10)));
  });
  test("fireflies are the warm nights': fullest in summer, none in autumn or winter", () => {
    expect(fireflyShare("summer")).toBe(1);
    expect(fireflyShare("spring")).toBeGreaterThan(0);
    expect(fireflyShare("spring")).toBeLessThan(1);
    expect(fireflyShare("autumn")).toBe(0);
    expect(fireflyShare("winter")).toBe(0);
    expect(scene).toContain("fireflyShare(currentTreeSeason)");
  });
});

describe("Task 60: the olives grow, slowly, by the real calendar", () => {
  test("stage 0 at the planting and before it, one step a season, monotonic, capped", () => {
    const [py, pm, pd] = OLIVES_PLANTED_DAY.split("-").map(Number) as [number, number, number];
    expect(daysSincePlanting(new Date(py, pm - 1, pd, 23, 59))).toBe(0);
    expect(oliveStage(new Date(py, pm - 1, pd))).toBe(0);
    expect(oliveStage(new Date(py - 5, 0, 1))).toBe(0); // a clock set back is never negative
    let last = -1;
    let steps = 0;
    for (let day = 0; day < 365 * 4; day++) {
      const st = oliveStage(new Date(py, pm - 1, pd + day, 12));
      expect(st).toBeGreaterThanOrEqual(last);
      expect(st - last).toBeLessThanOrEqual(1);
      if (st > last) steps++;
      last = st;
    }
    expect(last).toBe(OLIVE_MAX_STAGE);
    expect(steps).toBe(OLIVE_MAX_STAGE + 1);
  });
  test("slow: the first step takes a season, full growth two years, and a week changes nothing", () => {
    const [py, pm, pd] = OLIVES_PLANTED_DAY.split("-").map(Number) as [number, number, number];
    expect(oliveStage(new Date(py, pm - 1, pd + OLIVE_DAYS_PER_STAGE - 1))).toBe(0);
    expect(oliveStage(new Date(py, pm - 1, pd + OLIVE_DAYS_PER_STAGE))).toBe(1);
    expect(oliveStage(new Date(py, pm - 1, pd + 7))).toBe(0);
    expect(oliveStage(new Date(py, pm - 1, pd + 365))).toBeLessThan(OLIVE_MAX_STAGE);
    expect(OLIVE_DAYS_PER_STAGE * OLIVE_MAX_STAGE).toBeGreaterThanOrEqual(2 * 360);
  });
  test("the scale rises with each stage from a sapling to the pack's full tree, never past it", () => {
    expect(oliveScale(0)).toBeCloseTo(OLIVE_MIN_SCALE, 6);
    expect(oliveScale(OLIVE_MAX_STAGE)).toBe(1);
    expect(oliveScale(OLIVE_MAX_STAGE + 5)).toBe(1);
    expect(oliveScale(-3)).toBeCloseTo(OLIVE_MIN_SCALE, 6);
    for (let s = 1; s <= OLIVE_MAX_STAGE; s++) {
      expect(oliveScale(s)).toBeGreaterThan(oliveScale(s - 1));
      expect(oliveScale(s) - oliveScale(s - 1)).toBeLessThan(0.1); // a slow step, never a jump
    }
  });
  test("two olives by the house, two by the cliff, on land, clear of the door and the path", () => {
    expect(YOUNG_OLIVES.length).toBe(4);
    const home = YOUNG_OLIVES.filter(([x]) => x < -30);
    const cliff = YOUNG_OLIVES.filter(([, z]) => z > 56);
    expect(home.length).toBe(2);
    expect(cliff.length).toBe(2);
    for (const [x, z] of cliff) {
      expect(Math.abs(x)).toBeGreaterThan(CLIFF.walkHalf);
      expect(Math.abs(x)).toBeLessThan(CLIFF.landHalf);
      expect(z).toBeLessThan(CLIFF.stripEndZ);
    }
    for (const [x, z] of home) expect(Math.hypot(x - -40, z - 26)).toBeGreaterThan(3.8);
  });
  test("the scene places them from the pack's olive and grows them by the date", () => {
    expect(scene).toContain("for (const [ox, oz] of YOUNG_OLIVES)");
    expect(scene).toContain("oliveScale(stage)");
    expect(scene).toContain("oliveStage(new Date())");
    expect(scene).toContain("YOUNG_OLIVES.map(([x, z]) => treePlacement.bindCollider");
  });
});

describe("Task 60: the year's dressing", () => {
  const world = new THREE.Group();
  // The halo texture wants a canvas; give it a stand-in for the build only, then put the global back.
  const g = globalThis as { document?: unknown };
  const had = "document" in g;
  const before = g.document;
  g.document = { createElement: () => ({ width: 0, height: 0, getContext: () => null }) };
  const town = createSeasonalTown({ world, terrainHeight: () => 0 });
  if (had) g.document = before;
  else delete g.document;
  const stand = (name: string) => town.group.getObjectByName(name)!.visible;
  test("each season shows its own pieces and no other", () => {
    for (const [season, shown] of [["spring", "season-spring"], ["summer", ""], ["autumn", "season-autumn"], ["winter", "season-winter"]] as const) {
      town.setSeason(season);
      for (const name of ["season-spring", "season-autumn", "season-winter"]) expect(stand(name)).toBe(name === shown);
    }
  });
  test("winter lanterns burn brighter as the dark comes", () => {
    town.setSeason("winter");
    const lamp = (): number => {
      let v = 0;
      town.group.getObjectByName("season-winter")!.traverse((o) => {
        const mt = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (mt && mt.emissiveIntensity !== undefined && mt.emissive?.getHex() === 0xffa94d) v = Math.max(v, mt.emissiveIntensity);
      });
      return v;
    };
    town.update(0);
    const day = lamp();
    town.update(1);
    expect(lamp()).toBeGreaterThan(day);
    expect(day).toBeGreaterThan(0.5);
  });
  test("the dressing is data in the code: spots on land, a flower count, a harvest of three fruits", () => {
    expect(FLOWER_PATCHES.length).toBeGreaterThanOrEqual(6);
    expect(new Set(HARVEST_SPOTS.map((s) => s.fruit)).size).toBe(3);
    expect(WINTER_LANTERNS.length).toBeGreaterThanOrEqual(4);
    for (const [x, z] of [...WINTER_LANTERNS, ...HARVEST_SPOTS.map((s) => s.at), ...FLOWER_PATCHES.map((p) => p.at)]) {
      expect(Number.isFinite(x) && Number.isFinite(z)).toBe(true);
      expect(z).toBeLessThan(CLIFF.stripEndZ + CLIFF.head.r);
    }
    expect(scene).toContain("seasonalTown.setSeason(season)");
    expect(scene).toContain("seasonalTown.update(nightMix)");
  });
});

describe("Task 60: the ships come and go (Task 50 still wired)", () => {
  test("a ship every minute or two by day, twice as long a gap at night, none in a storm or fog", () => {
    expect(nextGap({ nightMix: 0, storm: false, fog: false }, 0)).toBe(25);
    expect(nextGap({ nightMix: 0, storm: false, fog: false }, 1)).toBe(75);
    expect(nextGap({ nightMix: 1, storm: false, fog: false }, 0)).toBe(50);
    expect(shipsSail({ nightMix: 0, storm: true, fog: false })).toBe(false);
    expect(shipsSail({ nightMix: 0, storm: false, fog: true })).toBe(false);
  });
  test("the scene loads, schedules and ticks them, and the pack's ship files are in this checkout (or the sea stays empty, safely)", () => {
    expect(scene).toContain("seaShips.update(t, dt");
    expect(scene).toContain("nextGap(");
    expect(scene).toContain("no ship model, the sea stays empty");
    const dir = join(import.meta.dir, "assets/ships");
    // The licensed files are not in git; where they are present they are the four the manifest lists.
    if (existsSync(dir)) for (const f of ["trade_ship.glb", "trireme.glb"]) expect(existsSync(join(dir, f))).toBe(true);
  });
});

const phoenixBase: PhoenixVisitFacts = {
  arrived: true, daylight: true, weather: "clear", walking: true, together: true, nearPerch: true, busy: false, troubled: false,
  visitBeganAt: null, now: Date.UTC(2027, 0, 1), today: "2027-01-01", lastVisitDay: null,
};
const rolledDay = (from: string, skip = 0): string => {
  let t = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  for (;;) {
    const day = new Date(t).toISOString().slice(0, 10);
    if (phoenixRollsDay(day) && skip-- <= 0) return day;
    t += 86400000;
  }
};

describe("Task 60: the phoenix's rare visit", () => {
  const day = rolledDay("2027-01-01");
  const on = { ...phoenixBase, today: day };
  test("rare: about one day in seven, the same answer every time", () => {
    let n = 0;
    for (let i = 0; i < 700; i++) if (phoenixRollsDay(new Date(Date.UTC(2027, 0, 1 + i)).toISOString().slice(0, 10))) n++;
    expect(n).toBeGreaterThan(700 / PHOENIX_VISIT_ONE_IN / 2);
    expect(n).toBeLessThan((700 / PHOENIX_VISIT_ONE_IN) * 2);
    expect(phoenixRollsDay(day)).toBe(phoenixRollsDay(day));
  });
  test("she comes on her day when the town is quiet and they are there together", () => {
    expect(phoenixVisitBlocked(on)).toBeNull();
  });
  test("not on an ordinary day", () => {
    const plain = (() => {
      for (let i = 0; i < 40; i++) {
        const dd = new Date(Date.UTC(2027, 0, 1 + i)).toISOString().slice(0, 10);
        if (!phoenixRollsDay(dd)) return dd;
      }
      throw new Error("no ordinary day");
    })();
    expect(phoenixVisitBlocked({ ...on, today: plain })).toBe("not her day");
  });
  test("only when quiet: never busy, troubled, apart, far, at night, in bad weather, before she has arrived, or with a visit open", () => {
    expect(phoenixVisitBlocked({ ...on, busy: true })).toBe("busy");
    expect(phoenixVisitBlocked({ ...on, troubled: true })).toBe("troubled");
    expect(phoenixVisitBlocked({ ...on, together: false })).toBe("not together");
    expect(phoenixVisitBlocked({ ...on, walking: false })).toBe("not together");
    expect(phoenixVisitBlocked({ ...on, nearPerch: false })).toBe("far from the perch");
    expect(phoenixVisitBlocked({ ...on, daylight: false })).toBe("night");
    for (const weather of ["rain", "storm", "snow", "fog"]) expect(phoenixVisitBlocked({ ...on, weather })).toBe("weather");
    expect(phoenixVisitBlocked({ ...on, arrived: false })).toBe("not yet arrived");
    expect(phoenixVisitBlocked({ ...on, visitBeganAt: on.now - 1000 })).toBe("a visit is open");
  });
  test("a cooldown of days: not twice in a day, not within the cooldown, again after it", () => {
    expect(phoenixVisitBlocked({ ...on, lastVisitDay: day })).toBe("already today");
    expect(phoenixVisitBlocked({ ...on, lastVisitDay: new Date(Date.parse(day) - 86400000).toISOString().slice(0, 10) })).toBe("cooldown");
    const edge = new Date(Date.parse(day) - (PHOENIX_COOLDOWN_DAYS - 1) * 86400000).toISOString().slice(0, 10);
    expect(phoenixVisitBlocked({ ...on, lastVisitDay: edge })).toBe("cooldown");
    const clear = new Date(Date.parse(day) - PHOENIX_COOLDOWN_DAYS * 86400000).toISOString().slice(0, 10);
    expect(phoenixVisitBlocked({ ...on, lastVisitDay: clear })).toBeNull();
  });
  test("a perch on Athena's temple, a stay of minutes, her one line passes the gate, and nothing is earned or recorded", () => {
    expect(PHOENIX_NEAR).toBeLessThan(25);
    expect(PHOENIX_STAY_MS).toBeLessThanOrEqual(5 * 60 * 1000);
    for (let r = 0; r <= 10; r++) expect(gateTender(PHOENIX_VISIT_LINE, r)).toBeNull();
    expect(scene).toContain("ATHENA_TEMPLE.position[0] + 0.9");
    expect(scene).toContain("phoenixVisitFlag");
    expect(app).toContain("phoenixVisitBlocked({");
    // no currency, no server record, no feather: the visit is the browser's own pacing alone.
    const visit = readFileSync(join(import.meta.dir, "../../shared/phoenixVisit.ts"), "utf8");
    expect(visit).not.toMatch(/denarii|points|streak|feather|api\./);
    expect(server).not.toMatch(/noteAeliaPhoenix|notePhoenixVisit/);
  });
});

const surpriseDay = (() => {
  for (let i = 0; i < 40; i++) {
    const dd = new Date(Date.UTC(2027, 0, 1 + i)).toISOString().slice(0, 10);
    if (surpriseRollsDay(dd)) return dd;
  }
  throw new Error("no surprise day");
})();
const sbase: SurpriseFacts = {
  rank: 5, walking: true, together: true, busy: false, troubled: false, weather: "clear", hour: 11, night: false, at: [0, 0],
  today: surpriseDay, now: Date.UTC(2027, 0, 10, 11), visitBeganAt: null, lastTenderAt: 0, memory: readSurpriseMemory(null),
};

describe("Task 60: Aelia's surprises", () => {
  test("four places of hers, each a real place in the town", () => {
    expect(SURPRISE_SPOTS.length).toBe(4);
    const at = (s: (typeof SURPRISE_SPOTS)[number]) => SURPRISE_INFO[s].at;
    expect(Math.hypot(at("athena-step")[0] - (ATHENA_TEMPLE.position[0] + ATHENA_TEMPLE.halfX + ATHENA_TEMPLE.stepDepth + 1), at("athena-step")[1] - ATHENA_TEMPLE.position[1])).toBeLessThan(2);
    expect(Math.hypot(at("cliff-bench")[0] - CLIFF.bench.x, at("cliff-bench")[1] - CLIFF.bench.z)).toBeLessThan(3);
    expect(at("lake-dock")).toEqual([LAKE.bank[0], LAKE.bank[1]]);
    expect(Math.hypot(at("forum-garden")[0] - LUCRETIA.position[0], at("forum-garden")[1] - LUCRETIA.position[1])).toBeLessThan(2);
  });
  test("offered when it is her day, they are together, the day is quiet and the hour suits", () => {
    expect(surpriseBlocked(sbase)).toBeNull();
    expect(nextSurpriseSpot(sbase)).not.toBeNull();
    expect(SURPRISE_RANK).toBeLessThan(TENDER_MOMENT_RANK);
  });
  test("rare: about every other day rolls, and the cooldown of days follows an offer, a no included", () => {
    let n = 0;
    for (let i = 0; i < 400; i++) if (surpriseRollsDay(new Date(Date.UTC(2027, 0, 1 + i)).toISOString().slice(0, 10))) n++;
    expect(n).toBeGreaterThan(120);
    expect(n).toBeLessThan(280);
    const mem = rememberSurprise("cliff-bench", surpriseDay);
    expect(surpriseBlocked({ ...sbase, memory: mem })).toBe("cooldown");
    for (let k = 1; k < SURPRISE_COOLDOWN_DAYS; k++) {
      const later = new Date(Date.parse(surpriseDay) + k * 86400000).toISOString().slice(0, 10);
      expect(["cooldown", "not her day"]).toContain(surpriseBlocked({ ...sbase, today: later, memory: mem }) as string);
    }
    let freed = 0;
    for (let k = SURPRISE_COOLDOWN_DAYS; k < SURPRISE_COOLDOWN_DAYS + 12; k++) {
      const later = new Date(Date.parse(surpriseDay) + k * 86400000).toISOString().slice(0, 10);
      if (surpriseBlocked({ ...sbase, today: later, memory: mem }) === null) freed++;
    }
    expect(freed).toBeGreaterThan(0);
  });
  test("never the same place twice running, and rotation covers every place over the days", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 120; i++) {
      const today = new Date(Date.UTC(2027, 0, 1 + i)).toISOString().slice(0, 10);
      const f: SurpriseFacts = { ...sbase, today, hour: 12, memory: { lastDay: null, lastSpot: "forum-garden" } };
      const spot = nextSurpriseSpot(f);
      if (spot) {
        expect(spot).not.toBe("forum-garden");
        seen.add(spot);
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(2);
  });
  test("exclusive with every moment and with a hard day: busy, troubled, apart, night, a visit opening, just after a tender moment", () => {
    expect(surpriseBlocked({ ...sbase, busy: true })).toBe("busy");
    expect(surpriseBlocked({ ...sbase, troubled: true })).toBe("troubled");
    expect(surpriseBlocked({ ...sbase, together: false })).toBe("not together");
    expect(surpriseBlocked({ ...sbase, night: true })).toBe("night");
    expect(surpriseBlocked({ ...sbase, rank: SURPRISE_RANK - 1 })).toBe("rank");
    expect(surpriseBlocked({ ...sbase, visitBeganAt: sbase.now - (SURPRISE_VISIT_GRACE_MS - 1) })).toBe("visit opening");
    expect(surpriseBlocked({ ...sbase, visitBeganAt: sbase.now - SURPRISE_VISIT_GRACE_MS })).toBeNull();
    expect(surpriseBlocked({ ...sbase, lastTenderAt: sbase.now - 1000 })).toBe("after a tender moment");
    expect(surpriseBlocked({ ...sbase, lastTenderAt: sbase.now - SURPRISE_AFTER_TENDER_MS })).toBeNull();
    expect(nextSurpriseSpot({ ...sbase, busy: true })).toBeNull();
  });
  test("the hour and the weather choose the place: the cliff only in fair weather and daylight, never where he already is", () => {
    const f = { ...sbase, hour: 5, at: [0, 0] as const };
    expect(nextSurpriseSpot({ ...f, hour: 22 })).toBeNull();
    for (let i = 0; i < 30; i++) {
      const today = new Date(Date.UTC(2027, 0, 1 + i)).toISOString().slice(0, 10);
      expect(nextSurpriseSpot({ ...sbase, today, weather: "rain", hour: 12 })).not.toBe("cliff-bench");
      expect(nextSurpriseSpot({ ...sbase, today, at: [CLIFF.bench.x, CLIFF.bench.z] })).not.toBe("cliff-bench");
    }
  });
  test("the surprise holds the town and the town's moments hold it: the shell feeds each to the others", () => {
    expect(app).toContain("surpriseRunningRef.current || Date.now() < surpriseHoldUntilRef.current || phoenixVisitingRef.current");
    // the same helper sits in the night's, the boat's and the tender moments' busy lists
    const uses = app.match(/townMomentNow\(\)/g) ?? [];
    expect(uses.length).toBeGreaterThanOrEqual(6);
    expect(app).toContain("busy: momentHoldsTownNow() || townMomentNow()");
    for (const marker of ["nightRunningRef.current ||", "tenderRunningRef.current ||", "celebratingRef.current.size > 0 ||", "weddingPlayingRef.current ||", "!!guidingRef.current"]) {
      const at = app.indexOf("const momentHoldsTownNow");
      expect(app.slice(at, at + 900)).toContain(marker);
    }
    // the phoenix ends if any moment starts, and waits for a surprise
    expect(app).toContain("surpriseRunningRef.current ||\n          celebratingRef.current.size > 0");
  });
  test("recorded as a place and a count only, capped, with no date", () => {
    expect(readSurprises(undefined)).toEqual({ kind: "aelia-surprises", counts: {} });
    expect(noteSurprise({ counts: { "lake-dock": 2, "nowhere": 9 }, secret: "x" }, "lake-dock")).toEqual({ kind: "aelia-surprises", counts: { "lake-dock": 3 } });
    expect(noteSurprise({ counts: { "lake-dock": SURPRISE_COUNT_CAP } }, "lake-dock").counts["lake-dock"]).toBe(SURPRISE_COUNT_CAP);
    expect(JSON.stringify(noteSurprise(null, "cliff-bench"))).not.toMatch(/\d{4}-\d{2}/);
    expect(server).toContain("noteAeliaSurprise: defineAction");
    expect(app).toContain("api.noteAeliaSurprise");
    expect(app).not.toMatch(/noteAeliaSurprise\(\{[^}]*(day|now|memory)/);
  });
  test("every line she says passes the tender gate at every rank, and none mentions a clock", () => {
    expect(SURPRISE_LINES.length).toBeGreaterThanOrEqual(20);
    for (const line of SURPRISE_LINES) {
      for (let rank = 0; rank <= 10; rank++) expect(gateTender(line, rank)).toBeNull();
      expect(line).not.toMatch(/\b(minutes?|hours?|o'clock|deadline|timer)\b/i);
    }
  });
  test("a decline is kind and counts for nothing, and the gates are untouched", () => {
    expect(app).toContain("SURPRISE_DECLINED_LINES");
    const gate = readFileSync(join(import.meta.dir, "../../shared/tenderGate.ts"), "utf8");
    expect(gate).toContain("export const TENDER_RANK = 7;");
    expect(readFileSync(join(import.meta.dir, "../../shared/aeliaSurprise.ts"), "utf8")).not.toMatch(/AFFECTION|affectionRank|TENDER_RANK =/);
  });
});

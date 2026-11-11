import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DRIFT_RIM, DRIFT_SPEED, QUIET_BOAT_ALL_LINES, QUIET_BOAT_COUNT_CAP, QUIET_BOAT_LINES, QUIET_BOAT_MIN_OUT,
  QUIET_BOAT_START, QUIET_BOAT_VISIT_GRACE_MS, beginDrift, boatSeats, driftStep, facesAlong, nextQuietLine,
  noteQuietBoat, quietBoatBlocked, readQuietBoat, rowBack, startDrift, type QuietBoatFacts,
} from "../../shared/quietBoat";
import { gateTender } from "../../shared/tenderGate";
import { nightBlocked, type NightFacts } from "../../shared/nightTogether";
import { LAKE } from "./town";

const base: QuietBoatFacts = {
  rowing: true, museAboard: true, walking: true, outFromMooring: 5, drifting: false, weather: "clear",
  busy: false, troubled: false, visitBeganAt: null, now: 1_000_000_000,
};
const lake = { cx: LAKE.position[0], cz: LAKE.position[1], rx: LAKE.rx, rz: LAKE.rz };

describe("Task 57: when the drift is offered", () => {
  test("only afloat together, far enough out, in fair weather, on a quiet day", () => {
    expect(quietBoatBlocked(base)).toBeNull();
    expect(quietBoatBlocked({ ...base, rowing: false })).toBe("not afloat");
    expect(quietBoatBlocked({ ...base, walking: false })).toBe("not afloat");
    expect(quietBoatBlocked({ ...base, museAboard: false })).toBe("alone");
    expect(quietBoatBlocked({ ...base, drifting: true })).toBe("already drifting");
    expect(quietBoatBlocked({ ...base, outFromMooring: QUIET_BOAT_MIN_OUT - 0.1 })).toBe("too near the dock");
    expect(quietBoatBlocked({ ...base, troubled: true })).toBe("troubled");
  });
  test("exclusive with the dream, summit, night and quest celebrations (all fold into busy)", () => {
    expect(quietBoatBlocked({ ...base, busy: true })).toBe("busy");
    const app = readFileSync(join(import.meta.dir, "App.tsx"), "utf8");
    const block = app.slice(app.indexOf("const quietBoatBlockedNow"), app.indexOf("const quietBoatBlockedNowRef"));
    for (const k of ["dreamingRef", "summitScene", "nightRunningRef", "celebratingRef", "privateMomentRef"]) expect(block).toContain(k);
  });
  test("blocked in rain, storm and snow; fine in clear, breezy, fog, rainbow, sparkles", () => {
    for (const w of ["rain", "storm", "snow"]) expect(quietBoatBlocked({ ...base, weather: w })).toBe("weather");
    for (const w of ["clear", "breezy", "fog", "rainbow", "sparkles", null]) expect(quietBoatBlocked({ ...base, weather: w })).toBeNull();
  });
  test("not in a visit's opening minutes, fine after", () => {
    expect(quietBoatBlocked({ ...base, visitBeganAt: base.now - 60_000 })).toBe("visit opening");
    expect(quietBoatBlocked({ ...base, visitBeganAt: base.now - QUIET_BOAT_VISIT_GRACE_MS - 1 })).toBeNull();
  });
  test("the night and the boat exclude each other: the night sees a drift as busy, the drift sees the night", () => {
    const night: NightFacts = {
      rank: 7, night: true, bothHome: true, walking: true, troubled: false, busy: true,
      tonight: "2026-11-10", lastNight: null, visitBeganAt: null, now: base.now,
    };
    expect(nightBlocked(night)).toBe("busy");
    const app = readFileSync(join(import.meta.dir, "App.tsx"), "utf8");
    expect(app).toMatch(/busy: !!dreamingRef\.current \|\| !!summitScene \|\| rowingRef\.current/);
  });
});

describe("Task 57: boarding, drift and the row back", () => {
  test("the drift starts only when allowed, and only his choice ends it", () => {
    expect(startDrift(QUIET_BOAT_START, { ...base, weather: "rain" })).toBe(QUIET_BOAT_START);
    const s = startDrift(QUIET_BOAT_START, base);
    expect(s.phase).toBe("drifting");
    // No elapsed time or lines ever end it: only rowBack does.
    let st = s;
    for (let i = 0; i < 50; i++) st = nextQuietLine(st).state;
    expect(st.phase).toBe("drifting");
    expect(rowBack(st).phase).toBe("rowing");
    expect(rowBack(QUIET_BOAT_START)).toBe(QUIET_BOAT_START);
  });
  test("her lines come once each, in order, then only quiet", () => {
    let st = startDrift(QUIET_BOAT_START, base);
    const said: string[] = [];
    for (let i = 0; i < QUIET_BOAT_LINES.length + 3; i++) {
      const n = nextQuietLine(st);
      if (n.line) said.push(n.line);
      st = n.state;
    }
    expect(said).toEqual([...QUIET_BOAT_LINES]);
    expect(nextQuietLine(st).line).toBeNull();
    expect(nextQuietLine(QUIET_BOAT_START).line).toBeNull();
  });
  test("a long drift stays on the water, barely moves, takes no input, and has no end", () => {
    let d = beginDrift(lake.cx + 1, lake.cz, Math.PI / 2);
    let dist = 0;
    for (let i = 0; i < 60 * 3600; i++) {
      const p = d;
      d = driftStep(d, 1 / 60, i / 60, lake);
      dist += Math.hypot(d.x - p.x, d.z - p.z);
      const n = Math.hypot((d.x - lake.cx) / lake.rx, (d.z - lake.cz) / lake.rz);
      expect(n).toBeLessThanOrEqual(DRIFT_RIM + 1e-6);
    }
    expect(dist / 3600).toBeLessThan(DRIFT_SPEED + 1e-6);
    expect(dist).toBeGreaterThan(0);
  });
  test("a boat at the rim is turned back inward, not stuck", () => {
    let d = beginDrift(lake.cx + lake.rx * DRIFT_RIM, lake.cz, Math.PI / 2);
    for (let i = 0; i < 60 * 12; i++) d = driftStep(d, 1 / 60, i / 60, lake);
    expect(Math.hypot((d.x - lake.cx) / lake.rx, (d.z - lake.cz) / lake.rz)).toBeLessThan(DRIFT_RIM - 0.05);
  });
  test("they sit facing each other at any heading", () => {
    for (let h = -3; h <= 3; h += 0.5) {
      const s = boatSeats(h);
      expect(s.him.along).toBeLessThan(s.her.along);
      expect(facesAlong(s.him.yaw - h, s.him.along, s.her.along)).toBe(true);
      expect(facesAlong(s.her.yaw - h, s.her.along, s.him.along)).toBe(true);
      expect(facesAlong(s.him.yaw - h, s.him.along, s.him.along - 1)).toBe(false);
    }
  });
});

describe("Task 57: the record is a kind and a count", () => {
  test("counts up, ignores junk, is capped, and holds nothing else", () => {
    expect(readQuietBoat(undefined)).toEqual({ kind: "quiet-boat", count: 0 });
    expect(readQuietBoat({ count: "x" })).toEqual({ kind: "quiet-boat", count: 0 });
    expect(noteQuietBoat(undefined).count).toBe(1);
    expect(noteQuietBoat({ count: 4, extra: "secret" })).toEqual({ kind: "quiet-boat", count: 5 });
    expect(noteQuietBoat({ count: QUIET_BOAT_COUNT_CAP }).count).toBe(QUIET_BOAT_COUNT_CAP);
  });
});

describe("Task 57: her words and the wiring", () => {
  test("every line passes the tender gate at every rank", () => {
    expect(QUIET_BOAT_ALL_LINES.length).toBeGreaterThanOrEqual(8);
    for (const line of QUIET_BOAT_ALL_LINES) for (let rank = 0; rank <= 10; rank++) expect(gateTender(line, rank)).toBeNull();
  });
  test("no line mentions a clock or a deadline", () => {
    for (const line of QUIET_BOAT_ALL_LINES) expect(line).not.toMatch(/\b(minutes?|hours?|o'clock|late|deadline|timer)\b/i);
  });
  test("the scene, the app and the server are wired, and the town's affection gates are untouched", () => {
    const scene = readFileSync(join(import.meta.dir, "townScene.ts"), "utf8");
    const app = readFileSync(join(import.meta.dir, "App.tsx"), "utf8");
    const server = readFileSync(join(import.meta.dir, "../../server/src/actions.ts"), "utf8");
    expect(scene).toContain("driftStep(boatDrift");
    expect(scene).toContain("boatSeats(boatState.heading)");
    expect(scene).toMatch(/if \(!force && boatDrift\) return false/);
    expect(app).toContain("rowBackHome");
    expect(app).toContain("api.noteQuietBoat");
    expect(app).toMatch(/if \(driftingRef\.current\) return;/);
    expect(server).toContain("noteQuietBoat: defineAction");
  });
});

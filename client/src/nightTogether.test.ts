import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  NIGHT_LINES,
  NIGHT_RANK,
  NIGHT_VISIT_GRACE_MS,
  acceptsAsk,
  darkBeatMs,
  invitesTonight,
  nightBlocked,
  nightKey,
  type NightFacts,
} from "../../shared/nightTogether";
import { HOME_KEEPSAKES } from "../../shared/homeDecor";
import { buildHomeHouse, buildKeepsake } from "./homeHouse";
import { earnedKeepsakes } from "./homeKeepsakes";
import { homeToWorld } from "./town";

const base: NightFacts = {
  rank: 7, night: true, bothHome: true, walking: true, troubled: false, busy: false,
  tonight: "2026-11-08", lastNight: null, visitBeganAt: null, now: 1_000_000_000,
};

describe("Task 45: when the night is offered", () => {
  test("from rank 7, at night, both home, once a night, never in a visit's opening minutes", () => {
    expect(nightBlocked(base)).toBeNull();
    expect(nightBlocked({ ...base, rank: NIGHT_RANK - 1 })).toBe("rank");
    expect(nightBlocked({ ...base, night: false })).toBe("day");
    expect(nightBlocked({ ...base, bothHome: false })).toBe("not home");
    expect(nightBlocked({ ...base, walking: false })).toBe("not home");
    expect(nightBlocked({ ...base, troubled: true })).toBe("troubled");
    expect(nightBlocked({ ...base, busy: true })).toBe("busy");
    expect(nightBlocked({ ...base, lastNight: "2026-11-08" })).toBe("once a night");
    expect(nightBlocked({ ...base, lastNight: "2026-11-07" })).toBeNull();
    expect(nightBlocked({ ...base, visitBeganAt: base.now - 60_000 })).toBe("visit opening");
    expect(nightBlocked({ ...base, visitBeganAt: base.now - NIGHT_VISIT_GRACE_MS - 1 })).toBeNull();
  });

  test("the hours after midnight belong to the same night", () => {
    expect(nightKey(new Date(2026, 10, 8, 23, 30))).toBe("2026-11-08");
    expect(nightKey(new Date(2026, 10, 9, 2, 15))).toBe("2026-11-08");
    expect(nightKey(new Date(2026, 10, 9, 13, 0))).toBe("2026-11-09");
  });

  test("she sometimes says no to his asking, and invites only some nights", () => {
    expect(acceptsAsk(0.1, { talkedToday: false })).toBe(true);
    expect(acceptsAsk(0.7, { talkedToday: false })).toBe(false);
    expect(acceptsAsk(0.7, { talkedToday: true })).toBe(true);
    expect(acceptsAsk(0.95, { talkedToday: true })).toBe(false);
    expect(invitesTonight(0.1, { talkedToday: false })).toBe(false);
    expect(invitesTonight(0.1, { talkedToday: true })).toBe(true);
    expect(invitesTonight(0.9, { talkedToday: true })).toBe(false);
    expect(darkBeatMs(true)).toBeLessThan(darkBeatMs(false));
  });

  test("no line describes anything", () => {
    for (const line of NIGHT_LINES) expect(line).not.toMatch(/undress|naked|nude|sex|make love|body|skin|bare/i);
  });
});

describe("Task 45: the house on a night together", () => {
  const ground = () => 0;
  test("the door stays shut and the lamp dims under the hush; the dawn lights the window", () => {
    const house = buildHomeHouse(ground);
    const inside = homeToWorld(0, 0);
    const atDoor = homeToWorld(0, 2.6);
    for (let i = 0; i < 60; i++) house.update(1 / 30, [inside, atDoor], 1);
    const lit = house.lamp.intensity;
    expect(lit).toBeGreaterThan(1);
    house.setHush({ doorShut: true, lampDim: 1, dawn: 0 });
    for (let i = 0; i < 150; i++) house.update(1 / 30, [inside, atDoor], 1);
    expect(house.lamp.intensity).toBeLessThan(lit * 0.4);
    const hinge = house.group.children.find((c) => c instanceof Object && c.type === "Group" && c.children.length >= 3);
    expect(hinge?.rotation.y ?? 0).toBeLessThan(0.05);
    house.setHush({ doorShut: true, lampDim: 1, dawn: 1 });
    house.update(1 / 30, [inside], 1);
    expect(house.lamp.intensity).toBeGreaterThan(4);
    house.setHush(null);
    for (let i = 0; i < 150; i++) house.update(1 / 30, [inside, atDoor], 1);
    expect(hinge?.rotation.y ?? 0).toBeGreaterThan(1);
  });

  test("their first night earns the lamp they kept lit", () => {
    const s = {
      fish: [], letters: [], postcards: [], inscriptions_complete: false, summit: { done: false },
      phoenix: { feathers: 0 }, secret: { first_kiss: null }, garden: { harvests: 0 }, tree: { waterings: 0 },
    };
    expect(earnedKeepsakes(s).has("night-lamp")).toBe(false);
    expect(earnedKeepsakes({ ...s, dating: { firsts: { night: "2026-11-08" } } }).has("night-lamp")).toBe(true);
    expect(HOME_KEEPSAKES.find((k) => k.id === "night-lamp")?.mount).toBe("shelf");
    expect(buildKeepsake("night-lamp").children.length).toBeGreaterThan(0);
  });
});

describe("Task 45: the shell keeps it private", () => {
  const app = readFileSync(join(import.meta.dir, "App.tsx"), "utf8");
  test("no view frame from the hush to the morning's end, and one dark frame for a director", () => {
    expect(app).toContain("!privateMomentRef.current && frameDue(");
    expect(app).toContain('g.fillStyle = "#000"');
  });
  test("the dark can be skipped, and a no from her ends as an ordinary rest", () => {
    expect(app).toContain('aria-label="Skip to morning"');
    expect(app).toMatch(/pending === "decline"\) restInTownRef\.current\(\)/);
  });
  test("the town never names what happened", () => {
    expect(app).not.toMatch(/spent the night|made love|slept together/i);
  });
});

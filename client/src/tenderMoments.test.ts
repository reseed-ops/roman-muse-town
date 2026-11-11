import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CLIFF_HAND_LINES, EMPTY_TENDER_MEMORY, TENDER_COUNT_CAP, TENDER_DAILY_CAP, TENDER_GLOBAL_SPACING_MS, TENDER_KINDS, TENDER_MOMENT_LINES,
  TENDER_MOMENT_RANK, TENDER_VISIT_GRACE_MS, atForumSpot, bravesWaiting, isTired, nextTenderKind, noteTender, onCliffPathSpot, readTender,
  readTenderMemory, rememberTender, tenderBlocked, tenderUnlocked, type TenderFacts, type TenderKind, type TenderRecord,
} from "../../shared/tenderMoments";
import { explicitIn, gateTender, TENDER_RANK } from "../../shared/tenderGate";
import { NIGHT_RANK } from "../../shared/nightTogether";
import { nightBlocked, type NightFacts } from "../../shared/nightTogether";
import { quietBoatBlocked, type QuietBoatFacts } from "../../shared/quietBoat";
import { CLIFF } from "./seaCliff";

const NOW = new Date(2026, 10, 10, 21, 0, 0).getTime();
const TODAY = "2026-11-10";
/** Everything had once, so every kind is unlocked. */
const ALL: TenderRecord = { kind: "tender-moments", counts: Object.fromEntries(TENDER_KINDS.map((k) => [k, 1])) };
const base: TenderFacts = {
  rank: 7, walking: true, together: true, busy: false, troubled: false, night: true, hour: 21, weather: "clear",
  bothHome: false, cameHome: false, atForum: false, onCliffPath: false, tired: false, bravesWaiting: 0,
  today: TODAY, now: NOW, visitBeganAt: null, record: ALL, memory: EMPTY_TENDER_MEMORY,
};
/** The facts that make each kind possible. */
const READY: Record<TenderKind, Partial<TenderFacts>> = {
  "cheek-kiss": { bothHome: true, cameHome: true, night: false, hour: 17 },
  "morning-bread": { bothHome: true, night: false, hour: 7 },
  "cliff-hand": { onCliffPath: true },
  "forehead-kiss": { tired: true },
  fireside: { bothHome: true, night: true, hour: 21 },
  "pillow-letter": { bothHome: true, night: true, hour: 22 },
  "slow-dance": { atForum: true, night: true },
  "hand-kiss": { bravesWaiting: 1 },
};
const ready = (k: TenderKind, extra: Partial<TenderFacts> = {}): TenderFacts => ({ ...base, ...READY[k], ...extra });

describe("Task 59: the rank and the kinds", () => {
  test("every moment sits at the terrace kiss's rank, as the night does", () => {
    expect(TENDER_MOMENT_RANK).toBe(TENDER_RANK);
    expect(TENDER_MOMENT_RANK).toBe(NIGHT_RANK);
    expect(TENDER_MOMENT_RANK).toBe(7);
    expect(TENDER_KINDS.length).toBe(8);
  });
  test("each kind is offered under its own conditions at rank 7 and above, never below", () => {
    for (const k of TENDER_KINDS) {
      for (const rank of [7, 8, 9, 10]) expect(tenderBlocked(k, ready(k, { rank }))).toBeNull();
      for (const rank of [0, 3, 6]) expect(tenderBlocked(k, ready(k, { rank }))).toBe("rank");
    }
  });
  test("the places and hours: forum after dark, cliff path, home at night or in the morning", () => {
    expect(tenderBlocked("slow-dance", ready("slow-dance", { night: false }))).not.toBeNull();
    expect(tenderBlocked("slow-dance", ready("slow-dance", { atForum: false }))).not.toBeNull();
    expect(tenderBlocked("slow-dance", ready("slow-dance", { weather: "rain" }))).not.toBeNull();
    expect(tenderBlocked("fireside", ready("fireside", { night: false }))).not.toBeNull();
    expect(tenderBlocked("fireside", ready("fireside", { bothHome: false }))).not.toBeNull();
    expect(tenderBlocked("morning-bread", ready("morning-bread", { hour: 12 }))).not.toBeNull();
    expect(tenderBlocked("morning-bread", ready("morning-bread", { night: true }))).not.toBeNull();
    expect(tenderBlocked("pillow-letter", ready("pillow-letter", { hour: 18 }))).not.toBeNull();
    expect(tenderBlocked("cliff-hand", ready("cliff-hand", { onCliffPath: false }))).not.toBeNull();
    expect(tenderBlocked("cliff-hand", ready("cliff-hand", { weather: "storm" }))).not.toBeNull();
    expect(tenderBlocked("cheek-kiss", ready("cheek-kiss", { cameHome: false }))).not.toBeNull();
    expect(tenderBlocked("forehead-kiss", ready("forehead-kiss", { tired: false }))).not.toBeNull();
    expect(tenderBlocked("hand-kiss", ready("hand-kiss", { bravesWaiting: 0 }))).not.toBeNull();
  });
  test("the zones: the forum and the sea cliff's own path", () => {
    expect(atForumSpot(2, -3)).toBe(true);
    expect(atForumSpot(40, 40)).toBe(false);
    expect(onCliffPathSpot(0, 80)).toBe(true);
    expect(onCliffPathSpot(0, CLIFF.walkFromZ)).toBe(true);
    expect(onCliffPathSpot(0, 30)).toBe(false);
    expect(onCliffPathSpot(CLIFF.walkHalf + 1, 80)).toBe(false);
  });
  test("tired is a long stay or the small hours; brave is a quest finished and not yet honoured", () => {
    expect(isTired(31 * 60_000, 15)).toBe(true);
    expect(isTired(5 * 60_000, 15)).toBe(false);
    expect(isTired(5 * 60_000, 1)).toBe(true);
    expect(bravesWaiting(2, readTender(null))).toBe(2);
    expect(bravesWaiting(2, noteTender(noteTender(null, "hand-kiss"), "hand-kiss"))).toBe(0);
    expect(bravesWaiting(0, readTender(null))).toBe(0);
  });
});

describe("Task 59: never demanded, never farmed", () => {
  test("a kind is had at most once a day", () => {
    const memory = rememberTender(EMPTY_TENDER_MEMORY, "fireside", TODAY, NOW - 5 * TENDER_GLOBAL_SPACING_MS, false);
    expect(tenderBlocked("fireside", ready("fireside", { memory }))).toBe("once a day");
    const tomorrow = new Date(2026, 10, 11, 21).getTime();
    expect(tenderBlocked("fireside", ready("fireside", { memory, today: "2026-11-11", now: tomorrow }))).toBeNull();
  });
  test("a global spacing between any two moments", () => {
    const memory = rememberTender(EMPTY_TENDER_MEMORY, "cheek-kiss", TODAY, NOW - TENDER_GLOBAL_SPACING_MS + 60_000, false);
    expect(tenderBlocked("slow-dance", ready("slow-dance", { memory }))).toBe("spacing");
    const later = { ...memory, lastAt: NOW - TENDER_GLOBAL_SPACING_MS - 1 };
    expect(tenderBlocked("slow-dance", ready("slow-dance", { memory: later }))).toBeNull();
  });
  test("a small cap a day", () => {
    let memory = EMPTY_TENDER_MEMORY;
    for (let i = 0; i < TENDER_DAILY_CAP; i++) memory = rememberTender(memory, TENDER_KINDS[i]!, TODAY, NOW - 10 * TENDER_GLOBAL_SPACING_MS, false);
    expect(tenderBlocked("slow-dance", ready("slow-dance", { memory }))).toBe("enough for today");
    expect(tenderBlocked("slow-dance", ready("slow-dance", { memory, today: "2026-11-11", now: NOW + 86_400_000 }))).toBeNull();
  });
  test("kinds unlock strictly in order, and only one new kind opens a day", () => {
    const none = readTender(null);
    expect(tenderUnlocked("cheek-kiss", none)).toBe(true);
    for (const k of TENDER_KINDS.slice(1)) expect(tenderUnlocked(k, none)).toBe(false);
    expect(tenderBlocked("slow-dance", ready("slow-dance", { record: none }))).toBe("locked");
    const one = noteTender(none, "cheek-kiss");
    expect(tenderUnlocked("morning-bread", one)).toBe(true);
    expect(tenderUnlocked("cliff-hand", one)).toBe(false);
    // The first time a kind is had, nothing new opens until another day.
    const memory = rememberTender(EMPTY_TENDER_MEMORY, "cheek-kiss", TODAY, NOW - 10 * TENDER_GLOBAL_SPACING_MS, true);
    expect(tenderBlocked("morning-bread", ready("morning-bread", { record: one, memory }))).toBe("one new thing a day");
    expect(tenderBlocked("morning-bread", ready("morning-bread", { record: one, memory, today: "2026-11-11", now: NOW + 86_400_000 }))).toBeNull();
  });
  test("only the first open kind is offered; nothing when none is possible", () => {
    expect(nextTenderKind(base)).toBeNull();
    expect(nextTenderKind({ ...base, ...READY["fireside"], ...READY["pillow-letter"] })).toBe("fireside");
    expect(nextTenderKind({ ...base, record: readTender(null), ...READY["slow-dance"] })).toBeNull();
  });
});

describe("Task 59: mutual exclusivity and the day's blocks", () => {
  test("busy (a dream, the summit, a night together, a boat, a quest celebration, the wedding, another moment) blocks every kind", () => {
    for (const k of TENDER_KINDS) expect(tenderBlocked(k, ready(k, { busy: true }))).toBe("busy");
  });
  test("a quarrel, a heavy day, a visit's opening minutes and being apart block every kind", () => {
    for (const k of TENDER_KINDS) {
      expect(tenderBlocked(k, ready(k, { troubled: true }))).toBe("troubled");
      expect(tenderBlocked(k, ready(k, { visitBeganAt: NOW - TENDER_VISIT_GRACE_MS + 1000 }))).toBe("visit opening");
      expect(tenderBlocked(k, ready(k, { visitBeganAt: NOW - TENDER_VISIT_GRACE_MS - 1000 }))).toBeNull();
      expect(tenderBlocked(k, ready(k, { together: false }))).toBe("not together");
      expect(tenderBlocked(k, ready(k, { walking: false }))).toBe("not together");
    }
  });
  test("the night and the boat treat a running moment as busy, and the moment treats them so", () => {
    const night: NightFacts = { rank: 7, night: true, bothHome: true, walking: true, troubled: false, busy: false, tonight: "2026-11-10", lastNight: null, visitBeganAt: null, now: NOW };
    expect(nightBlocked(night)).toBeNull();
    expect(nightBlocked({ ...night, busy: true })).toBe("busy");
    const boat: QuietBoatFacts = { rowing: true, museAboard: true, walking: true, outFromMooring: 5, drifting: false, weather: "clear", busy: false, troubled: false, visitBeganAt: null, now: NOW };
    expect(quietBoatBlocked({ ...boat, busy: true })).toBe("busy");
    const app = readFileSync(join(import.meta.dir, "App.tsx"), "utf8");
    // The night's and the boat's busy flags include a running tender moment; a moment's own includes the night, the boat, the wedding and the celebrations.
    expect(app).toContain("rowingRef.current || nightRunningRef.current || tenderRunningRef.current");
    expect(app).toMatch(/privateMomentRef\.current \|\|\s+tenderRunningRef\.current \|\|\s+celebratingRef\.current\.size > 0 \|\|\s+weddingPlayingRef\.current/);
    const facts = app.slice(app.indexOf("const tenderFactsNow = ()"), app.indexOf("const tenderFactsNowRef"));
    for (const flag of ["dreamingRef", "summitScene", "nightRunningRef", "rowingRef", "celebratingRef", "weddingPlayingRef", "tenderRunningRef", "dancingRef", "museBubbleRef"]) expect(facts).toContain(flag);
  });
});

describe("Task 59: the record is kinds and counts only", () => {
  test("a count per kind, nothing else: no dates, no streak, no currency", () => {
    const r = noteTender({ counts: { "cheek-kiss": 2 }, streak: 9, denarii: 100, last: "2026-11-10" }, "fireside");
    expect(r).toEqual({ kind: "tender-moments", counts: { "cheek-kiss": 2, fireside: 1 } });
    expect(Object.keys(r)).toEqual(["kind", "counts"]);
    for (const v of Object.values(r.counts)) expect(Number.isInteger(v)).toBe(true);
    expect(JSON.stringify(r)).not.toMatch(/streak|denarii|date|20\d\d/);
  });
  test("junk and unknown kinds are dropped, counts are capped", () => {
    expect(readTender(undefined)).toEqual({ kind: "tender-moments", counts: {} });
    expect(readTender({ counts: { "cheek-kiss": "x", fireside: -3, nonsense: 5, "slow-dance": 2.9 } })).toEqual({ kind: "tender-moments", counts: { "slow-dance": 2 } });
    expect(noteTender({ counts: { fireside: TENDER_COUNT_CAP } }, "fireside").counts.fireside).toBe(TENDER_COUNT_CAP);
  });
  test("the pacing memory the client keeps is sanitised and never leaves the browser", () => {
    expect(readTenderMemory("junk")).toEqual(EMPTY_TENDER_MEMORY);
    const m = readTenderMemory({ lastAt: 5, lastDay: { fireside: "2026-11-10", bad: "x", "cheek-kiss": "not a day" }, newKindDay: "2026-11-10", day: "2026-11-10", dayCount: 3 });
    expect(m.lastDay).toEqual({ fireside: "2026-11-10" });
    const app = readFileSync(join(import.meta.dir, "App.tsx"), "utf8");
    expect(app).toContain("api.noteTenderMoment({ kind })");
    expect(app).not.toMatch(/noteTenderMoment\(\{[^}]*(day|now|memory)/);
  });
});

describe("Task 59: her words stay tender", () => {
  test("every line passes the tender gate at ranks 7 to 10", () => {
    expect(TENDER_MOMENT_LINES.length).toBeGreaterThanOrEqual(25);
    for (const line of TENDER_MOMENT_LINES) {
      expect(explicitIn(line) ? `explicit: ${line}` : "ok").toBe("ok");
      for (let rank = 7; rank <= 10; rank++) expect(gateTender(line, rank) ?? "ok").toBe("ok");
    }
  });
  test("the hand on the cliff path says nothing at all", () => {
    expect(CLIFF_HAND_LINES).toEqual([]);
  });
  test("explicit lines are still refused at every rank, 0 to 10", () => {
    for (const line of ["Let us make love tonight.", "Take off your tunic for me.", "I want you naked.", "Lie beneath me, my love.", "Touch me there.", "Come, take me to bed."]) {
      for (let rank = 0; rank <= 10; rank++) expect(gateTender(line, rank)).toBe("explicit");
    }
  });
  test("nothing is described: no line names a body, a bed's use or an act", () => {
    for (const line of TENDER_MOMENT_LINES) expect(line).not.toMatch(/\b(naked|undress|body|bodies|touch|caress|bed|skin|breath|lips)\b/i);
  });
});

describe("Task 59: the wiring", () => {
  const app = readFileSync(join(import.meta.dir, "App.tsx"), "utf8");
  const scene = readFileSync(join(import.meta.dir, "townScene.ts"), "utf8");
  const house = readFileSync(join(import.meta.dir, "homeHouse.ts"), "utf8");
  const server = readFileSync(join(import.meta.dir, "../../server/src/actions.ts"), "utf8");
  test("the app runs the watch, the offers, the veil and the letter", () => {
    expect(app).toContain("nextTenderKind(f)");
    expect(app).toContain("beginTender(kind)");
    expect(app).toContain('scene.startDance(true)');
    expect(app).toContain("data-mt-tender-letter");
    expect(app).toContain("beginPrivateMoment();\n    fadeVeil(true);");
    expect(app).toContain("noteTenderDeclined");
  });
  test("the scene and the house build the props with no second light", () => {
    expect(scene).toContain("setTenderProp: (prop) => homeHouse.setTender(prop)");
    expect(scene).toContain("function beginDance(inPlace = false)");
    expect(house).toContain("setTender(prop)");
    expect(house).toContain("fireLamp");
    expect(house).not.toMatch(/new THREE\.PointLight[\s\S]*new THREE\.PointLight/);
  });
  test("the server keeps only the kind and the count, from rank 7, and the gates are not touched", () => {
    expect(server).toContain("noteTenderMoment: defineAction");
    expect(server).toContain("TENDER_MOMENT_RANK");
    const gate = readFileSync(join(import.meta.dir, "../../shared/tenderGate.ts"), "utf8");
    expect(gate).toContain("export const TENDER_RANK = 7;");
  });
});

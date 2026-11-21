import { expect, test } from "bun:test";
import { advance, blockChance, challenge, cue, forfeit, press, windowMs } from "./sparringBout";

const open = () => 1;
test("the parry window includes its opening and excludes its closing instant", () => {
  const b = challenge(100);
  expect(press(b, 699, open).archer).toBe(1);
  expect(press(b, 700, open).lastEvent).toContain("Clash");
  expect(press(b, 1149.99, open).archer).toBe(0);
  expect(press(b, 1150, open).archer).toBe(1);
  expect(advance(b, 1150).archer).toBe(1);
});
test("a parry passes to Gaius, then a landed touch starts another round", () => {
  const parried = press(challenge(0), 600, open);
  const attack = advance(parried, parried.until);
  expect(cue(attack)).toContain("Strike!");
  const scored = press(attack, attack.since, open);
  expect([scored.gaius, scored.archer]).toEqual([1, 0]);
  const next = advance(scored, scored.until);
  expect([next.round, next.phase]).toEqual([2, "telegraph"]);
});
test("blocks and missed attack windows pass without scoring", () => {
  const attack = advance(challenge(0), 1700);
  expect(attack.phase).toBe("strike");
  expect(press(attack, attack.since, () => 0.249).lastEvent).toBe("Archer blocks.");
  expect(press(attack, attack.since, () => 0.25).gaius).toBe(1);
  const missed = press(attack, attack.until, open);
  expect([missed.phase, missed.gaius, missed.archer]).toEqual(["pass", 0, 1]);
});
test("rounds tighten timing and raise the block probability to their limits", () => {
  expect(windowMs(1)).toBe(450);
  expect(windowMs(2)).toBeCloseTo(414);
  expect(windowMs(100)).toBeCloseTo(247.5);
  expect(blockChance(1)).toBe(0.25);
  expect(blockChance(3)).toBeCloseTo(0.45);
  expect(blockChance(5)).toBe(0.6);
  expect(blockChance(100)).toBe(0.6);
});
test("either resident can win on the fifth touch", () => {
  for (const who of ["gaius", "archer"] as const) {
    let b = challenge(0);
    for (let round = 1; round <= 5; round++) {
      b = press(b, who === "gaius" ? b.until : b.since, open);
      if (b.phase === "result") break;
      b = advance(b, b.until);
      b = who === "gaius" ? press(b, b.since, open) : advance(b, b.until);
      if (round < 5) b = advance(b, b.until);
    }
    expect(b[who]).toBe(5);
    expect(b.phase).toBe("result");
    expect(b.lastEvent).toContain("5–0");
  }
});
test("a forfeit holds the result, re-arms the prompt and allows a fresh rematch", () => {
  const ended = forfeit(press(challenge(0), 100, open), 200);
  expect(press(ended, 300, open)).toEqual(ended);
  expect(cue(ended)).toContain("forfeit");
  expect(cue(advance(ended, ended.until))).toBe("Spar with Archer");
  const fresh = challenge(4000);
  expect([fresh.phase, fresh.round, fresh.gaius, fresh.archer, fresh.lastEvent]).toEqual(["telegraph", 1, 0, 0, ""]);
});

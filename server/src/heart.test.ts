import { describe, expect, test } from "bun:test";
import {
  BELIEFS,
  BELIEF_VOICE,
  episodeFor,
  fadeFeelings,
  feelSentiment,
  moodLine,
  reflect,
} from "./heart";

const calm = { warmth: 0, joy: 0, concern: 0 };

describe("feelings", () => {
  test("heavy weather worries her, strong weather twice as much", () => {
    expect(feelSentiment(calm, "low", "mild").concern).toBe(20);
    expect(feelSentiment(calm, "strained", "strong").concern).toBe(40);
  });

  test("his joy eases her worry", () => {
    const worried = { ...calm, concern: 40 };
    const after = feelSentiment(worried, "bright", "mild");
    expect(after.concern).toBe(30);
    expect(after.joy).toBe(15);
  });

  test("a no-signal message changes nothing", () => {
    expect(feelSentiment(calm, "none", "none")).toEqual(calm);
  });

  test("feelings stay in range and fade by real days", () => {
    expect(feelSentiment({ warmth: 95, joy: 0, concern: 0 }, "warm", "strong").warmth).toBe(100);
    expect(fadeFeelings({ warmth: 20, joy: 8, concern: 5 }, 2)).toEqual({ warmth: 4, joy: 0, concern: 0 });
  });

  test("no state is ever cold toward him", () => {
    expect(moodLine(calm, 5)).toBe("");
    expect(moodLine({ ...calm, joy: 30 }, 5)).toContain("good spirits");
    expect(moodLine({ ...calm, warmth: 30 }, 5)).toContain("fond");
  });

  test("concern outranks joy, and its shape follows closeness", () => {
    const f = { warmth: 50, joy: 50, concern: 30 };
    expect(moodLine(f, 1)).toContain("keep your distance");
    expect(moodLine(f, 4)).toContain("watching over");
    expect(moodLine(f, 8)).toContain("look after him");
  });
});

describe("reflect", () => {
  test("nothing forms below the thresholds", () => {
    const r = reflect({ WARM: 2, BRIGHT: 2, HEAVY: 1, WATERED: 4 }, []);
    expect(r.add).toEqual([]);
    expect(r.episodes).toEqual({ WARM: 2, BRIGHT: 2, HEAVY: 1, WATERED: 4 });
  });

  test("counted days fold into beliefs and are spent", () => {
    const r = reflect({ WARM: 3, WATERED: 5 }, []);
    expect(r.add).toEqual(["steady", "tends"]);
    expect(r.episodes).toEqual({});
  });

  test("a held belief is not formed twice, and its days are still spent", () => {
    const r = reflect({ WARM: 3 }, ["steady"]);
    expect(r.add).toEqual([]);
    expect(r.episodes).toEqual({});
  });

  test("a hard stretch heals into having come through it", () => {
    const r = reflect({ BRIGHT: 2 }, ["hard-stretch"]);
    expect(r.remove).toEqual(["hard-stretch"]);
    expect(r.add).toEqual(["came-through"]);
  });

  test("bright days alone do not claim a recovery from nothing", () => {
    expect(reflect({ BRIGHT: 2 }, []).add).toEqual([]);
  });

  test("a forgotten hard stretch is not brought back as a recovery", () => {
    const r = reflect({ BRIGHT: 2 }, ["hard-stretch"], ["hard-stretch"]);
    expect(r.add).toEqual([]);
    expect(r.remove).toEqual([]);
  });

  test("a forgotten belief stays held, so it does not grow back", () => {
    expect(reflect({ HEAVY: 2 }, ["hard-stretch"]).add).toEqual([]);
  });
});

test("only the days that matter count as episodes", () => {
  expect(episodeFor("bright")).toBe("BRIGHT");
  expect(episodeFor("warm")).toBe("WARM");
  expect(episodeFor("weary")).toBe("HEAVY");
  expect(episodeFor("content")).toBeNull();
  expect(episodeFor("none")).toBeNull();
});

test("every belief has both voices, and none turns against him", () => {
  expect(Object.keys(BELIEF_VOICE).sort()).toEqual(Object.keys(BELIEFS).sort());
  for (const text of [...Object.values(BELIEFS), ...Object.values(BELIEF_VOICE)]) {
    expect(text).not.toMatch(/guard|wary|wrong|slight|distrust/i);
  }
});

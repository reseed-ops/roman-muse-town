import { expect, test } from "bun:test";
import {
  PAD_VERB_MAX_MS,
  SIGHT_LINE,
  SPEAK_MAX_CHARS,
  VISIT_ANCHOR_NAMES,
  VISIT_DIRECTION_KINDS,
  countWords,
  validateDirection,
  withinTownRim,
} from "./visitProtocol";

// Muse Visits: the seam's direction validation, total and strict.

test("every direction kind validates its shape, and nothing unknown passes", () => {
  expect(VISIT_DIRECTION_KINDS).toEqual(["goto", "sit", "stand", "seat", "stepout", "emote", "speak", "intend", "look", "pad"]);
  for (const anchor of VISIT_ANCHOR_NAMES) expect(validateDirection({ kind: "goto", anchor })).toEqual({ ok: true, direction: { kind: "goto", anchor } });
  expect(validateDirection({ kind: "goto", anchor: "moon" })).toEqual({ ok: false, error: "unknown anchor: moon" });
  expect(validateDirection({ kind: "goto", x: 3.5, z: -4 })).toEqual({ ok: true, direction: { kind: "goto", x: 3.5, z: -4 } });
  expect(validateDirection({ kind: "goto", x: 300, z: 0 })).toEqual({ ok: false, error: "ground point out of the world" });
  expect(validateDirection({ kind: "goto", x: "3", z: 0 }).ok).toBe(false);
  expect(validateDirection({ kind: "goto" }).ok).toBe(false);
  for (const kind of ["sit", "stand", "seat", "stepout", "look"] as const) expect(validateDirection({ kind, extra: 1 })).toEqual({ ok: true, direction: { kind } });
  expect(validateDirection({ kind: "emote", emote: "wave" })).toEqual({ ok: true, direction: { kind: "emote", emote: "wave" } });
  expect(validateDirection({ kind: "emote", emote: "cartwheel" }).ok).toBe(false);
  expect(validateDirection({ kind: "intend", text: "  She means to sit by the lake. " })).toEqual({ ok: true, direction: { kind: "intend", text: "She means to sit by the lake." } });
  expect(validateDirection({ kind: "intend", text: "x".repeat(121) }).ok).toBe(false);
  expect(validateDirection({ kind: "fly" })).toEqual({ ok: false, error: "unknown direction kind: fly" });
  expect(validateDirection(null)).toEqual({ ok: false, error: "a direction is an object" });
  expect(validateDirection([])).toEqual({ ok: false, error: "a direction is an object" });
  expect(validateDirection("speak").ok).toBe(false);
});

test("speak keeps the cap, trims, and a partial needs its lineId", () => {
  expect(validateDirection({ kind: "speak", text: " There you are. " })).toEqual({ ok: true, direction: { kind: "speak", text: "There you are." } });
  expect(validateDirection({ kind: "speak", text: "" }).ok).toBe(false);
  expect(validateDirection({ kind: "speak", text: "a".repeat(SPEAK_MAX_CHARS) }).ok).toBe(true);
  expect(validateDirection({ kind: "speak", text: "a".repeat(SPEAK_MAX_CHARS + 1) })).toEqual({ ok: false, error: `speak text over ${SPEAK_MAX_CHARS} characters` });
  expect(validateDirection({ kind: "speak", text: "There", partial: true })).toEqual({ ok: false, error: "a partial speak needs a lineId" });
  expect(validateDirection({ kind: "speak", text: "There", partial: true, lineId: "L1" })).toEqual({ ok: true, direction: { kind: "speak", text: "There", partial: true, lineId: "L1" } });
  expect(validateDirection({ kind: "speak", text: "There you are.", lineId: "L1" })).toEqual({ ok: true, direction: { kind: "speak", text: "There you are.", lineId: "L1" } });
  expect(countWords("  one two   three ")).toBe(3);
});

test("the pad verb is a bounded vector held for at most five seconds", () => {
  expect(validateDirection({ kind: "pad", dx: 0.5, dz: -1, ms: 1500 })).toEqual({ ok: true, direction: { kind: "pad", dx: 0.5, dz: -1, buttons: [], ms: 1500 } });
  expect(validateDirection({ kind: "pad", dx: 0, dz: 0, buttons: ["a", "a", "x"], ms: 10.6 })).toEqual({ ok: true, direction: { kind: "pad", dx: 0, dz: 0, buttons: ["a", "x"], ms: 11 } });
  expect(validateDirection({ kind: "pad", dx: 2, dz: 0, ms: 100 }).ok).toBe(false);
  expect(validateDirection({ kind: "pad", dx: 0, dz: 0, ms: PAD_VERB_MAX_MS + 1 }).ok).toBe(false);
  expect(validateDirection({ kind: "pad", dx: 0, dz: 0, ms: 0 }).ok).toBe(false);
  expect(validateDirection({ kind: "pad", dx: 0, dz: 0, buttons: ["y"], ms: 100 }).ok).toBe(false);
  expect(validateDirection({ kind: "pad", dx: 0, dz: 0, buttons: "a", ms: 100 }).ok).toBe(false);
});

test("the rim and the consent line are what they say", () => {
  expect(withinTownRim(30, 30)).toBe(true);
  expect(withinTownRim(40, 40)).toBe(false);
  expect(SIGHT_LINE).toBe("Muse can see your view while visiting.");
});

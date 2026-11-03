import { expect, test } from "bun:test";
import {
  PAD2_IDLE_SEC,
  PAD2_KEYS,
  isPad2Key,
  keyboardButton,
  keyboardStick,
  noPads,
  pad2Live,
  pad2StatusLine,
  pressedButtons,
  routePads,
  stickVector,
} from "./padRouting";

// Player 2 routing (Task 3): which pad maps to whom, how a stick and
// its buttons become town input, the keyboard stand-in, the fold-back
// clock, and the menu's status words.

const padA = { index: 0, id: "Xbox Wireless Controller (A)" };
const padB = { index: 1, id: "Xbox Wireless Controller (B)" };

test("the first pad to appear is Gaius, the next distinct pad is Aelia", () => {
  const one = routePads(noPads(), [padA]);
  expect(one).toEqual({ p1: padA, p2: null });
  const two = routePads(one, [padA, padB]);
  expect(two).toEqual({ p1: padA, p2: padB });
  // The same two pads next frame: nothing moves.
  expect(routePads(two, [padB, padA])).toEqual(two);
});

test("a pad keeps its seat while connected and a vanished pad frees its seat without a reshuffle", () => {
  const two = routePads(routePads(noPads(), [padA]), [padA, padB]);
  const aGone = routePads(two, [padB]);
  expect(aGone).toEqual({ p1: null, p2: padB });
  // A returns (or a new pad at that index): it takes the free seat, Aelia's pad stays hers.
  expect(routePads(aGone, [padA, padB])).toEqual({ p1: padA, p2: padB });
  // A different pad at a reused index is a new pad, not the old seat holder.
  const swapped = { index: 0, id: "Other Controller" };
  expect(routePads(two, [swapped, padB])).toEqual({ p1: swapped, p2: padB });
});

test("the stick has a dead zone, rescales from it, flips Y to up-is-forward, and never exceeds one", () => {
  expect(stickVector(0.1, -0.1)).toEqual({ x: 0, y: 0 });
  const up = stickVector(0, -1);
  expect(up.x).toBeCloseTo(0, 6);
  expect(up.y).toBeCloseTo(1, 6);
  const edge = stickVector(0.16, 0);
  expect(edge.x).toBeGreaterThan(0);
  expect(edge.x).toBeLessThan(0.03);
  const half = stickVector(0.575, 0);
  expect(half.x).toBeCloseTo(0.5, 6);
  const corner = stickVector(1, 1);
  expect(Math.hypot(corner.x, corner.y)).toBeCloseTo(1, 6);
});

test("button presses are edges, named by the standard mapping", () => {
  expect(pressedButtons([], [true, false, false, false])).toEqual(["a"]);
  expect(pressedButtons([true, false, false, false], [true, true, false, true])).toEqual(["b", "y"]);
  expect(pressedButtons([true, true, true, true], [true, true, true, true])).toEqual([]);
  expect(pressedButtons([false], [false, false, true])).toEqual(["x"]);
});

test("the keyboard stand-in is the right hand's cluster and never WASD or the arrows", () => {
  for (const key of ["w", "a", "s", "d", "arrowup", "arrowleft", "space", "c", "e"]) expect(isPad2Key(key)).toBe(false);
  for (const key of Object.values(PAD2_KEYS)) expect(isPad2Key(key)).toBe(true);
  expect(keyboardStick(new Set(["i"]))).toEqual({ x: 0, y: 1 });
  const diagonal = keyboardStick(new Set(["k", "j"]));
  expect(diagonal.x).toBeCloseTo(-Math.SQRT1_2, 9);
  expect(diagonal.y).toBeCloseTo(-Math.SQRT1_2, 9);
  expect(keyboardStick(new Set(["i", "k"]))).toEqual({ x: 0, y: 0 });
  expect(keyboardStick(new Set(["w"]))).toEqual({ x: 0, y: 0 });
  expect(keyboardButton("u")).toBe("a");
  expect(keyboardButton("o")).toBe("b");
  expect(keyboardButton("p")).toBe("x");
  expect(keyboardButton("y")).toBeNull();
  expect(keyboardButton(" ")).toBeNull();
});

test("pad2 owns her for a few seconds of silence, then folds back", () => {
  expect(pad2Live(10, 10)).toBe(true);
  expect(pad2Live(10, 10 + PAD2_IDLE_SEC - 0.01)).toBe(true);
  expect(pad2Live(10, 10 + PAD2_IDLE_SEC)).toBe(false);
  expect(pad2Live(-Infinity, 0)).toBe(false);
});

test("the menu line names who drives her, then the second pad's connection", () => {
  const base = { padConnected: true, following: true, harness: "off" as const };
  expect(pad2StatusLine({ ...base, driver: "pad" })).toBe("Aelia: driven by the second controller. Second controller connected.");
  expect(pad2StatusLine({ ...base, driver: "keyboard", padConnected: false })).toBe(
    "Aelia: driven by the keyboard. No second controller; keyboard IJKL moves her, U jumps, O slides, P sits or waves.",
  );
  expect(pad2StatusLine({ ...base, driver: "harness", harness: "behind" })).toBe("Aelia: follow driver, behind Gaius. Second controller connected.");
  expect(pad2StatusLine({ ...base, driver: "harness", harness: "beside" })).toContain("beside Gaius");
  expect(pad2StatusLine({ ...base, driver: "self" })).toStartWith("Aelia: walking with you on her own.");
  expect(pad2StatusLine({ ...base, driver: "self", following: false })).toStartWith("Aelia: keeping her own routine.");
});

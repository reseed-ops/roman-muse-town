import { expect, test } from "bun:test";
import { airborne, JUMP_BUFFER_SEC, newJump, stepJump } from "./jump";

function fly(dt: number) {
  const jump = newJump();
  jump.queuedAt = 0;
  let peak = 0;
  let now = 0;
  for (let i = 0; i < 2000; i++) {
    const landed = stepJump(jump, dt, now, true);
    peak = Math.max(peak, jump.y);
    now += dt;
    if (landed) return { peak, airtime: now };
  }
  throw new Error("never landed");
}

test("the hop is about a unit high and half a second long, at any frame rate", () => {
  for (const dt of [1 / 30, 1 / 60, 1 / 120]) {
    const { peak, airtime } = fly(dt);
    expect(peak).toBeGreaterThan(0.85);
    expect(peak).toBeLessThan(1.1);
    expect(airtime).toBeGreaterThan(0.5);
    expect(airtime).toBeLessThan(0.62);
  }
});

test("no double jump, but a press just before landing is kept", () => {
  const jump = newJump();
  jump.queuedAt = 0;
  stepJump(jump, 0.02, 0, true);
  const vy = jump.vy;
  jump.queuedAt = 0.02;
  stepJump(jump, 0.02, 0.02, true);
  expect(jump.vy).toBeLessThan(vy);
  let now = 0.02;
  while (!stepJump(jump, 0.02, now, true)) {
    now += 0.02;
    jump.queuedAt = now - JUMP_BUFFER_SEC / 2;
  }
  stepJump(jump, 0.02, now + 0.02, true);
  expect(airborne(jump)).toBe(true);
});

test("a stale press does nothing", () => {
  const jump = newJump();
  jump.queuedAt = 0;
  stepJump(jump, 0.02, 1, true);
  expect(airborne(jump)).toBe(false);
});

test("sitting, rowing or dancing cancels a hop", () => {
  const jump = newJump();
  jump.queuedAt = 0;
  stepJump(jump, 0.02, 0, true);
  stepJump(jump, 0.02, 0.02, false);
  expect(airborne(jump)).toBe(false);
});

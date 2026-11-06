import { describe, expect, test } from "bun:test";
import { PAIR_CAM, PAIR_CAM_HOME_S, PAIR_CAM_LINGER_S, newPairCamState, stepPairCam, type PairKind } from "./pairCam";
import { wrapAngle } from "./followCam";

// The pair camera driven through a whole moment at 60 fps, with the
// scene's own timing: the 0.9 s glide, the clip (both Outdoor pair
// takes run 3.33 s, measured from the files on Nov 6, 2026) plus the
// scene's 0.35 s tail, then the linger and the way home (Task 20).
const CLIP_S = 3.33;
const GLIDE_S = 0.9;
const TAIL_S = 0.35;
const DT = 1 / 60;
const REST = 10.5;

type Sample = { t: number; phase: string; off: number; boom: number | null; mix: number; released: boolean; framing: PairKind | null };

function drive(kind: PairKind, camFree = true): Sample[] {
  const s = newPairCamState();
  const walkHeading = 0.3;
  let camYaw = walkHeading;
  let t = 0;
  const out: Sample[] = [];
  const phases: [string, number, { kind: PairKind; glide: boolean } | null][] = [
    ["glide", GLIDE_S, { kind, glide: true }],
    ["hold", CLIP_S + TAIL_S, { kind, glide: false }],
    ["after", PAIR_CAM_LINGER_S + PAIR_CAM_HOME_S + 1, null],
  ];
  for (const [phase, len, pair] of phases) {
    for (let k = 0; k < Math.round(len / DT); k++) {
      const step = stepPairCam(s, { dt: DT, pair, walkHeading, camYaw, camFree, reducedMotion: false, sideBoom: () => REST });
      camYaw = step.camYaw;
      t += DT;
      out.push({ t, phase, off: wrapAngle(camYaw - walkHeading), boom: step.boom, mix: step.mix, released: step.released, framing: step.framing });
    }
  }
  return out;
}

describe("the flirt's pair camera (Task 20)", () => {
  const sm = drive("flirt");
  const hold = sm.filter((x) => x.phase === "hold");
  const holdStart = hold[0]!.t - DT;
  const holdEnd = hold.at(-1)!.t;
  const linger = sm.filter((x) => x.phase === "after" && x.t <= holdEnd + PAIR_CAM_LINGER_S - DT / 2);

  test("the glide is not framed", () => {
    for (const x of sm.filter((x) => x.phase === "glide")) {
      expect(x.framing).toBeNull();
      expect(x.boom).toBeNull();
      expect(Math.abs(x.off)).toBeLessThan(1e-9);
    }
  });
  test("it reaches the three-quarter within two seconds of the hold and is at 0.95 rad, 5.5 m by the clip's end", () => {
    const settled = hold.filter((x) => x.t - holdStart >= 2.0);
    expect(settled.length).toBeGreaterThan(60);
    for (const x of settled) {
      expect(x.off).toBeGreaterThan(0.9);
      expect(x.boom).toBe(PAIR_CAM.flirt.boom);
    }
    expect(hold.at(-1)!.off).toBeGreaterThan(0.94);
    expect(hold.at(-1)!.off).toBeLessThanOrEqual(0.95);
  });
  test("it holds the framing through the pose's release, then comes home", () => {
    expect(linger.length).toBeGreaterThan(55);
    for (const x of linger) {
      expect(x.framing).toBe("flirt");
      expect(x.off).toBeGreaterThan(0.94);
      expect(x.boom).toBe(PAIR_CAM.flirt.boom);
    }
    expect(sm.filter((x) => x.released).length).toBe(1);
    const releasedAt = sm.find((x) => x.released)!.t;
    expect(releasedAt - holdEnd).toBeCloseTo(PAIR_CAM_LINGER_S, 1);
    const last = sm.at(-1)!;
    expect(Math.abs(last.off)).toBeLessThan(0.05);
    expect(last.boom).toBeNull();
    expect(last.framing).toBeNull();
  });
  test("the flirt keeps the walk's height and aim (mix stays 0)", () => {
    for (const x of sm) expect(x.mix).toBe(0);
  });
});

describe("the hug's pair camera", () => {
  const sm = drive("hug");
  const hold = sm.filter((x) => x.phase === "hold");
  const holdStart = hold[0]!.t - DT;
  test("side-on at 1.6 rad, 3.8 m, aimed at the pair, within two seconds, held through the release", () => {
    for (const x of hold.filter((x) => x.t - holdStart >= 2.0)) {
      expect(x.off).toBeGreaterThan(1.5);
      expect(x.boom).toBe(PAIR_CAM.hug.boom);
      expect(x.mix).toBeGreaterThan(0.95);
    }
    const holdEnd = hold.at(-1)!.t;
    for (const x of sm.filter((x) => x.phase === "after" && x.t <= holdEnd + PAIR_CAM_LINGER_S - DT / 2)) {
      expect(x.off).toBeGreaterThan(1.5);
      expect(x.mix).toBeGreaterThan(0.95);
    }
    expect(Math.abs(sm.at(-1)!.off)).toBeLessThan(0.05);
    expect(sm.at(-1)!.mix).toBe(0);
  });
});

describe("the gate", () => {
  test("a camera that is not free is held off: no yaw, no boom, and it says so", () => {
    const sm = drive("flirt", false);
    for (const x of sm) {
      expect(Math.abs(x.off)).toBeLessThan(1e-9);
      expect(x.boom).toBeNull();
    }
    const s = newPairCamState();
    const step = stepPairCam(s, { dt: DT, pair: { kind: "flirt", glide: false }, walkHeading: 0, camYaw: 0, camFree: false, reducedMotion: false, sideBoom: () => REST });
    expect(step.heldOff).toBe(true);
  });
  test("a trunk on the side line shortens the boom but never past the kind's own", () => {
    const s = newPairCamState();
    const near = stepPairCam(s, { dt: DT, pair: { kind: "hug", glide: false }, walkHeading: 0, camYaw: 0, camFree: true, reducedMotion: false, sideBoom: () => 2.4 });
    expect(near.boom).toBe(2.4);
    const far = stepPairCam(s, { dt: DT, pair: { kind: "hug", glide: false }, walkHeading: 0, camYaw: 0, camFree: true, reducedMotion: false, sideBoom: () => 9 });
    expect(far.boom).toBe(PAIR_CAM.hug.boom);
  });
});

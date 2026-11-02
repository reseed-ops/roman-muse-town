/**
 * Swing-first pixel-ratio tuner (v44).
 *
 * The older AdaptiveQuality watches the MEAN frame time over one
 * second windows and needs five sustained slow seconds plus a long
 * cooldown before it moves, so a two or three second camera swing,
 * exactly where the owner feels the stutter, never trips it: the
 * burst hides inside the mean and is gone before the sustained
 * window fills. This tuner watches the p95 instead, over short
 * windows, and owns ONLY the pixel ratio while the town is at full
 * quality: shadow policy and the coarse tiers stay with
 * AdaptiveQuality, and nothing here ever touches a material, so a
 * step can never stall on a shader recompile.
 *
 * The ladder runs from the device cap down to a floor of 1 in
 * quarter steps. A window whose p95 stays over budget steps the
 * ratio down at once; recovery needs three consecutive comfortable
 * windows, so the ratio breathes down fast under a swing and comes
 * back up slowly when the load falls, and the town looks exactly as
 * it did whenever the ratio sits at the cap.
 */

export const PERF_TUNER = {
  /** Frames per judgement window (about 1.5 s at 60 fps). */
  windowFrames: 90,
  /** p95 over this (ms) is over budget: step down. */
  budgetP95Ms: 20,
  /** p95 under this (ms) is headroom: counts toward stepping up. */
  headroomP95Ms: 12,
  /** Consecutive headroom windows required before stepping up. */
  recoveryWindows: 3,
  /** Never render below this ratio, however heavy the load. */
  floor: 1,
} as const;

/** The ratio ladder for a cap: cap, then quarter steps down to the floor. */
export function ratioLadder(cap: number): number[] {
  const top = Math.max(PERF_TUNER.floor, Math.round(cap * 4) / 4);
  const ladder: number[] = [];
  for (let r = top; r > PERF_TUNER.floor; r = Math.round((r - 0.25) * 100) / 100) ladder.push(r);
  ladder.push(PERF_TUNER.floor);
  return ladder;
}

/** p95 of a frame-time sample set (ms), 0 for an empty set. */
export function p95Of(samples: readonly number[]): number {
  if (!samples.length) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] ?? 0;
}

export class PixelRatioTuner {
  private ladder: number[];
  private idx = 0;
  private window: number[] = [];
  private headroomStreak = 0;

  constructor(cap: number) {
    this.ladder = ratioLadder(cap);
  }

  get ratio(): number {
    return this.ladder[this.idx] ?? PERF_TUNER.floor;
  }

  /** Ladder position name for the perf line: the cap reads full,
   *  the floor reads light, anything between reads balanced. */
  get tierLabel(): "full" | "balanced" | "light" {
    if (this.idx <= 0) return "full";
    if (this.idx >= this.ladder.length - 1) return "light";
    return "balanced";
  }

  /**
   * Feed one frame time (ms). Returns the new ratio when a step
   * lands, otherwise null. Suspended or absurd frames (hidden tab,
   * a long hitch) reset the window instead of poisoning it, the
   * same honesty rule the older monitors follow.
   */
  sample(frameMs: number, visible = true): number | null {
    if (!visible || frameMs <= 0 || frameMs > 1000 || !Number.isFinite(frameMs)) {
      this.window = [];
      this.headroomStreak = 0;
      return null;
    }
    this.window.push(frameMs);
    if (this.window.length < PERF_TUNER.windowFrames) return null;
    const p95 = p95Of(this.window);
    this.window = [];
    if (p95 > PERF_TUNER.budgetP95Ms) {
      this.headroomStreak = 0;
      if (this.idx < this.ladder.length - 1) {
        this.idx++;
        return this.ratio;
      }
      return null;
    }
    if (p95 < PERF_TUNER.headroomP95Ms) {
      this.headroomStreak++;
      if (this.headroomStreak >= PERF_TUNER.recoveryWindows && this.idx > 0) {
        this.idx--;
        this.headroomStreak = 0;
        return this.ratio;
      }
      return null;
    }
    this.headroomStreak = 0;
    return null;
  }

  reset(): void {
    this.window = [];
    this.headroomStreak = 0;
  }
}

/**
 * The town menu's quiet perf line (v44): one stable format, whole
 * numbers, driven by the rolling snapshot the scene already keeps
 * (a 120 frame ring, so the last few seconds). The quality word is
 * the pixel-ratio tuner's tier while the town runs at full quality,
 * so the line says why the picture softened when it did.
 */
export function formatPerfLine(snapshot: { fps: number; p95Ms: number }, qualityLabel: string): string {
  const fps = Math.max(0, Math.round(snapshot.fps));
  const p95 = Math.max(0, Math.round(snapshot.p95Ms));
  return `Perf: ${fps} fps · p95 ${p95} ms · quality ${qualityLabel}`;
}

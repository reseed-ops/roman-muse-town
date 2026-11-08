export type QualityTier = 0 | 1 | 2;
export type QualityMode = "auto" | "full" | "light";

/** Sustained frame-time windows plus asymmetric recovery prevent oscillation.
 * A hidden tab or a long suspended frame resets the observation window. */
/** Phones (Task 41): start light, step up only on proven headroom. A
 *  phone renders at a capped 30 fps, so frame times all read about 33 ms
 *  and cannot show headroom; the frame's own work time can. */
export const PHONE_QUALITY = {
  /** Frames per work-time window. */
  windowFrames: 45,
  /** A window whose work p95 is under this is comfortable. */
  comfortableP95Ms: 14,
  /** Consecutive comfortable windows before stepping up. */
  windows: 3,
} as const;

export class AdaptiveQuality {
  tier: QualityTier = 2;
  /** Phones start a tier down (ratio 1, no shadows) and step up on work-time headroom. */
  private readonly phone: boolean;
  private work: number[] = [];
  private comfortable = 0;
  constructor(opts: { phone?: boolean } = {}) {
    this.phone = !!opts.phone;
    if (this.phone) this.tier = 1;
  }
  private mode: QualityMode = "auto";
  private total = 0;
  private frames = 0;
  private slowMs = 0;
  private fastMs = 0;
  private lastChange = 0;
  private startedAt: number | null = null;

  setMode(mode: QualityMode, now: number): QualityTier {
    if (mode === this.mode) return this.tier;
    this.mode = mode;
    if (mode !== "auto") this.tier = mode === "light" ? 0 : 2;
    else if (this.phone) this.tier = 1;
    this.lastChange = now;
    this.reset();
    return this.tier;
  }

  reset(): void { this.total = this.frames = this.slowMs = this.fastMs = 0; }

  sample(dt: number, now: number, visible = true): QualityTier {
    if (this.startedAt === null) this.startedAt = now;
    if (!visible || dt > 1000 || dt <= 0 || !Number.isFinite(dt)) { this.reset(); return this.tier; }
    if (this.mode !== "auto" || now - this.startedAt < 8000) return this.tier;
    this.total += dt;
    this.frames++;
    if (this.total < 1000) return this.tier;
    const mean = this.total / this.frames;
    this.slowMs = mean > 38 ? this.slowMs + this.total : 0;
    this.fastMs = mean < 21 ? this.fastMs + this.total : 0;
    this.total = this.frames = 0;
    if (now - this.lastChange < 15000) return this.tier;
    if (this.slowMs >= 5000 && this.tier > 0) {
      this.tier = (this.tier - 1) as QualityTier;
    } else if (!this.phone && this.fastMs >= 25000 && this.tier < 2) {
      this.tier = (this.tier + 1) as QualityTier;
    } else return this.tier;
    this.lastChange = now;
    this.reset();
    return this.tier;
  }

  /** A phone's frame work time (ms): three comfortable windows in a row
   *  step it up a tier (never more often than the tier cooldown). Returns
   *  true when the tier rose. */
  noteWork(workMs: number, now: number): boolean {
    if (!this.phone || this.mode !== "auto" || this.tier >= 2 || !Number.isFinite(workMs) || workMs <= 0) return false;
    this.work.push(workMs);
    if (this.work.length < PHONE_QUALITY.windowFrames) return false;
    const sorted = [...this.work].sort((a, b) => a - b);
    const p95 = sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] ?? 0;
    this.work = [];
    this.comfortable = p95 < PHONE_QUALITY.comfortableP95Ms ? this.comfortable + 1 : 0;
    if (this.comfortable < PHONE_QUALITY.windows || now - this.lastChange < 15000) return false;
    this.tier = (this.tier + 1) as QualityTier;
    this.comfortable = 0;
    this.lastChange = now;
    this.reset();
    return true;
  }
}

export type QualityTier = 0 | 1 | 2;
export type QualityMode = "auto" | "full" | "light";

/** Sustained frame-time windows plus asymmetric recovery prevent oscillation.
 * A hidden tab or a long suspended frame resets the observation window. */
export class AdaptiveQuality {
  tier: QualityTier = 2;
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
    } else if (this.fastMs >= 25000 && this.tier < 2) {
      this.tier = (this.tier + 1) as QualityTier;
    } else return this.tier;
    this.lastChange = now;
    this.reset();
    return this.tier;
  }
}

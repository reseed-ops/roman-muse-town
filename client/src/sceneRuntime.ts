import type * as THREE from "three";
import { AdaptiveQuality } from "./adaptiveQuality";
import { GraphicsQuality } from "./graphicsQuality";
import { PerformanceMonitor } from "./performanceMonitor";
import { PixelRatioTuner, formatPerfLine } from "./perfTuner";
import { ProximityLoader, type LoadPosition } from "./proximityLoader";

/** Rendering policy has its own lifecycle; movement/collision stays in the scene. */
export class SceneRuntime {
  readonly streaming = new ProximityLoader();
  readonly graphics: GraphicsQuality;
  private adaptive = new AdaptiveQuality();
  private monitor = new PerformanceMonitor();
  private tuner: PixelRatioTuner;
  private light: boolean;
  private automatic = true;
  private lastFocus = -Infinity;

  constructor(private renderer: THREE.WebGLRenderer, scene: THREE.Scene, private fullRatio: number, private software: boolean, private resize: () => void) {
    this.graphics = new GraphicsQuality(renderer, scene, fullRatio, software);
    this.tuner = new PixelRatioTuner(fullRatio);
    this.light = software;
    try { this.automatic = localStorage.getItem("muse-town-auto-graphics") !== "0"; } catch { /* defaults */ }
    this.updateMode(performance.now());
  }
  private updateMode(now: number) {
    this.adaptive.setMode(this.light || this.software ? "light" : this.automatic ? "auto" : "full", now);
  }
  private applyQuality(recompile: boolean) {
    const tier = this.adaptive.tier;
    // At full tier the swing tuner owns the exact ratio (its ladder
    // tops out at the same cap, so a fresh town renders identically);
    // the coarse tiers below keep their long-standing ratios.
    const ratio = tier === 2 ? (this.automatic && !this.light ? this.tuner.ratio : this.fullRatio) : tier === 1 ? Math.min(1, this.fullRatio) : Math.min(0.75, this.fullRatio);
    if (this.graphics.setProfile(ratio, tier === 2 && !this.software, recompile)) this.resize();
  }
  setLightGraphics(on: boolean): void {
    this.light = on;
    this.updateMode(performance.now());
    this.applyQuality(true);
  }
  setAutomatic(on: boolean): void {
    this.automatic = on;
    this.updateMode(performance.now());
    this.applyQuality(true);
  }
  beforeFrame(dt: number, now: number, focus: LoadPosition, overview: boolean, visible: boolean): void {
    const before = this.adaptive.tier;
    this.adaptive.sample(dt, now, visible);
    if (before !== this.adaptive.tier) {
      // Drop shadows without a compile stall. Recovery is rare and restores
      // the material variants once, after a sustained period of headroom.
      this.applyQuality(this.adaptive.tier > before);
    } else if (this.automatic && !this.light && !this.software && this.adaptive.tier === 2) {
      // The swing tuner (v44): p95 over short windows, ratio steps
      // only, applied without touching shadows or materials.
      const stepped = this.tuner.sample(dt, visible);
      if (stepped !== null && this.graphics.setPixelRatioOnly(stepped)) this.resize();
    }
    if (visible && now - this.lastFocus >= 250) {
      this.lastFocus = now;
      this.streaming.updateFocus(focus, overview);
    }
  }
  afterFrame(dt: number, cpuMs: number, visible: boolean): void { this.monitor.sample(dt, cpuMs, visible); }
  get grassHz(): number { return this.adaptive.tier === 2 ? 30 : this.adaptive.tier === 1 ? 15 : 0; }
  snapshot() { return this.monitor.snapshot(this.renderer.info, this.renderer.getPixelRatio(), this.adaptive.tier, this.streaming.progress()); }
  /** The town menu's perf line (v44): rolling fps and p95 from the
   *  monitor, and the quality word from whoever currently owns the
   *  ratio: the tuner at full tier, the coarse tier below it. */
  perfLine(): string {
    const snap = this.snapshot();
    const label = !this.automatic || this.light || this.software || this.adaptive.tier < 2
      ? ["light", "balanced", "full"][this.adaptive.tier] ?? "full"
      : this.tuner.tierLabel;
    // Frames slower than a second are not counted, so a stalled town
    // reads "measuring", never a misleading 0 fps (fix list, Nov 7).
    const line = snap.fps > 0 ? formatPerfLine(snap, label) : `Perf: measuring · quality ${label}`;
    // No GPU (a VM, a software renderer): say so, or 1 fps reads as a bug.
    return this.software ? `${line} · software rendering, no GPU` : line;
  }
  dispose(): void { this.streaming.dispose(); }
}

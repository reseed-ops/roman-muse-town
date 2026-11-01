import type * as THREE from "three";
import { AdaptiveQuality } from "./adaptiveQuality";
import { GraphicsQuality } from "./graphicsQuality";
import { PerformanceMonitor } from "./performanceMonitor";
import { ProximityLoader, type LoadPosition } from "./proximityLoader";

/** Rendering policy has its own lifecycle; movement/collision stays in the scene. */
export class SceneRuntime {
  readonly streaming = new ProximityLoader();
  readonly graphics: GraphicsQuality;
  private adaptive = new AdaptiveQuality();
  private monitor = new PerformanceMonitor();
  private light: boolean;
  private automatic = true;
  private lastFocus = -Infinity;

  constructor(private renderer: THREE.WebGLRenderer, scene: THREE.Scene, private fullRatio: number, private software: boolean, private resize: () => void) {
    this.graphics = new GraphicsQuality(renderer, scene, fullRatio, software);
    this.light = software;
    try { this.automatic = localStorage.getItem("muse-town-auto-graphics") !== "0"; } catch { /* defaults */ }
    this.updateMode(performance.now());
  }
  private updateMode(now: number) {
    this.adaptive.setMode(this.light || this.software ? "light" : this.automatic ? "auto" : "full", now);
  }
  private applyQuality(recompile: boolean) {
    const tier = this.adaptive.tier;
    const ratio = tier === 2 ? this.fullRatio : tier === 1 ? Math.min(1, this.fullRatio) : Math.min(0.75, this.fullRatio);
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
    }
    if (visible && now - this.lastFocus >= 250) {
      this.lastFocus = now;
      this.streaming.updateFocus(focus, overview);
    }
  }
  afterFrame(dt: number, cpuMs: number, visible: boolean): void { this.monitor.sample(dt, cpuMs, visible); }
  get grassHz(): number { return this.adaptive.tier === 2 ? 30 : this.adaptive.tier === 1 ? 15 : 0; }
  snapshot() { return this.monitor.snapshot(this.renderer.info, this.renderer.getPixelRatio(), this.adaptive.tier, this.streaming.progress()); }
  dispose(): void { this.streaming.dispose(); }
}

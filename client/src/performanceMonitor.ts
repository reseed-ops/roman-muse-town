import type { LoadProgress } from "./proximityLoader";
import type { QualityTier } from "./adaptiveQuality";

export interface PerformanceSnapshot {
  fps: number; frameMs: number; p95Ms: number; cpuMs: number;
  drawCalls: number; triangles: number; textures: number; geometries: number;
  pixelRatio: number; quality: QualityTier; loading: LoadProgress;
}

export class PerformanceMonitor {
  private samples: number[] = [];
  private cursor = 0;
  private cpuMs = 0;
  sample(frameMs: number, cpuMs: number, visible: boolean): void {
    if (!visible || frameMs <= 0 || frameMs > 1000 || !Number.isFinite(frameMs)) {
      this.samples = []; this.cursor = 0; return;
    }
    if (this.samples.length < 120) this.samples.push(frameMs);
    else { this.samples[this.cursor] = frameMs; this.cursor = (this.cursor + 1) % 120; }
    this.cpuMs = this.cpuMs ? this.cpuMs * 0.9 + cpuMs * 0.1 : cpuMs;
  }
  snapshot(info: { render: { calls: number; triangles: number }; memory: { textures: number; geometries: number } }, pixelRatio: number, quality: QualityTier, loading: LoadProgress): PerformanceSnapshot {
    const sorted = [...this.samples].sort((a, b) => a - b);
    const mean = sorted.length ? sorted.reduce((sum, v) => sum + v, 0) / sorted.length : 0;
    return {
      fps: mean ? 1000 / mean : 0, frameMs: mean, p95Ms: sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] ?? 0,
      cpuMs: this.cpuMs, drawCalls: info.render.calls, triangles: info.render.triangles,
      textures: info.memory.textures, geometries: info.memory.geometries, pixelRatio, quality, loading,
    };
  }
}

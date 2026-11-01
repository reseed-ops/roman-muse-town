export interface LoadPosition { x: number; z: number }
export interface LoadProgress { total: number; loaded: number; failed: number; active: number; deferred: number }
interface Job {
  positions: (() => LoadPosition)[];
  eager: boolean;
  priority: number;
  run(): Promise<void>;
  cancel(): void;
}

/** Per-scene streaming queue. Far jobs do not start downloads or parses.
 * Loaded assets stay resident for the visit, so crossing a boundary cannot
 * repeatedly reload a building or change its collision geometry. */
export class ProximityLoader {
  private queue: Job[] = [];
  private active = 0;
  private total = 0;
  private loaded = 0;
  private failed = 0;
  private focus: LoadPosition = { x: 0, z: 4 };
  private opened = false;
  private disposed = false;
  private overview = false;

  constructor(private radius = 32, private concurrency = 3) {}

  request<T>(load: () => Promise<T>, position: () => LoadPosition, options: { eager?: boolean; priority?: number } = {}): Promise<T> {
    if (this.disposed) return Promise.reject(new Error("Scene disposed"));
    this.total++;
    const result = new Promise<T>((resolve, reject) => {
      this.queue.push({
        positions: [position], eager: options.eager ?? false, priority: options.priority ?? 1,
        cancel: () => reject(new Error("Scene disposed")),
        run: async () => {
          try {
            // Let scene-specific consumers dispose a result arriving after teardown.
            const result = await load();
            this.loaded++;
            resolve(result);
          } catch (error) {
            this.failed++;
            reject(error);
          } finally {
            this.active--;
            this.pump();
          }
        },
      });
    });
    this.pump();
    return result;
  }

  updateFocus(position: LoadPosition, overview = false): void {
    this.focus = position;
    this.overview = overview;
    this.opened = true;
    this.pump();
  }

  private distance(job: Job): number {
    return Math.min(...job.positions.map((read) => {
      const p = read();
      return Math.hypot(p.x - this.focus.x, p.z - this.focus.z);
    }));
  }

  private pump(): void {
    if (!this.opened || this.disposed) return;
    while (this.active < this.concurrency) {
      let next = -1;
      let best = Infinity;
      for (let i = 0; i < this.queue.length; i++) {
        const job = this.queue[i]!;
        const distance = this.distance(job);
        if (!job.eager && !this.overview && distance > this.radius) continue;
        const score = (job.eager ? -10000 : 0) + job.priority * 100 + distance;
        if (score < best) { best = score; next = i; }
      }
      if (next < 0) return;
      const job = this.queue.splice(next, 1)[0]!;
      this.active++;
      void job.run();
    }
  }

  progress(): LoadProgress {
    return { total: this.total, loaded: this.loaded, failed: this.failed, active: this.active, deferred: this.queue.length };
  }

  dispose(): void {
    this.disposed = true;
    for (const job of this.queue) job.cancel();
    this.queue = [];
  }
}

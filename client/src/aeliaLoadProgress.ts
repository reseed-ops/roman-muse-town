// Honest, monotonic progress for the in-browser Gemma load.
//
// transformers.js reports 0-100 per FILE, and the processor and the model
// load side by side, so forwarding those numbers raw made the bar run to
// 100% on a small file and fall back to 10% on the next (Task 115). This
// tracker sums bytes over every file seen so far, never reports a lower
// percent than it already has (new files discovered late only slow the
// climb), and holds at 99% until the caller marks the download complete.
export type LoadProgressEvent = {
  status: string;
  name?: string;
  file?: string;
  loaded?: number;
  total?: number;
};

// Until the known files add up to this much, the percent would only describe
// the small config files that arrive first, so none is shown.
const MIN_TOTAL_BYTES = 1_000_000;

export function createLoadProgress(modelName: string, emit: (message: string) => void, minTotal = MIN_TOTAL_BYTES) {
  const files = new Map<string, { loaded: number; total: number }>();
  let last = -1;
  let finished = false;

  const say = (percent: number) => {
    if (percent <= last) return;
    last = percent;
    emit(`Downloading ${modelName} model files: ${percent}%…`);
  };

  return {
    onProgress(info: LoadProgressEvent): void {
      if (finished || info.status !== "progress") return;
      if (typeof info.loaded !== "number" || typeof info.total !== "number" || info.total <= 0) return;
      files.set(`${info.name ?? ""}/${info.file ?? ""}`, { loaded: info.loaded, total: info.total });
      let loaded = 0;
      let total = 0;
      for (const entry of files.values()) {
        loaded += Math.min(entry.loaded, entry.total);
        total += entry.total;
      }
      if (total < minTotal) return;
      say(Math.min(99, Math.max(0, Math.floor((loaded / total) * 100))));
    },
    /** Download done: 100% is reported once, then the load stage takes over. */
    finishDownload(): void {
      if (finished) return;
      finished = true;
      if (last >= 0) emit(`Downloaded ${modelName} model files: 100%.`);
      emit(`Starting ${modelName} on your GPU (no more downloading)…`);
    },
  };
}

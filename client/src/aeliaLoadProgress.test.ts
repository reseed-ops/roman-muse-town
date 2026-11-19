import { expect, test } from "bun:test";
import { createLoadProgress } from "./aeliaLoadProgress";

// Task 115: raw per-file 0-100 values made the bar read 100% then 10%.
test("progress over many parallel files never decreases and is labelled", () => {
  const messages: string[] = [];
  const t = createLoadProgress("Gemma 4 E4B", (m) => messages.push(m), 100);
  // Small processor files finish first, then a big model file starts: the
  // old per-file numbers went 100 -> 10 here.
  t.onProgress({ status: "progress", name: "m", file: "tok.json", loaded: 10, total: 10 });
  t.onProgress({ status: "progress", name: "m", file: "model.onnx_data", loaded: 100, total: 1000 });
  t.onProgress({ status: "progress", name: "m", file: "model.onnx_data", loaded: 600, total: 1000 });
  // A late-discovered file enlarges the total; the shown percent must hold.
  t.onProgress({ status: "progress", name: "m", file: "embed.onnx_data", loaded: 1, total: 5000 });
  t.onProgress({ status: "progress", name: "m", file: "model.onnx_data", loaded: 1000, total: 1000 });
  t.onProgress({ status: "progress", name: "m", file: "embed.onnx_data", loaded: 5000, total: 5000 });
  const pcts = messages.map((m) => Number(/(\d+)%/.exec(m)?.[1] ?? NaN)).filter((n) => !Number.isNaN(n));
  expect(pcts.length).toBeGreaterThan(2);
  for (let i = 1; i < pcts.length; i++) expect(pcts[i]).toBeGreaterThan(pcts[i - 1]!);
  expect(Math.max(...pcts)).toBeLessThanOrEqual(99);
  expect(messages.every((m) => m.includes("Gemma 4 E4B"))).toBe(true);
  t.finishDownload();
  expect(messages.at(-2)).toContain("100%");
  expect(messages.at(-1)).toContain("Starting Gemma 4 E4B");
});

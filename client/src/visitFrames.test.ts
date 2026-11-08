import { expect, test } from "bun:test";
import { base64Bytes, frameDimensions, frameDue, validateFrameDataUrl } from "./visitFrames";
import { FRAME_CADENCE_MS, FRAME_MAX_BYTES, FRAME_MAX_EDGE } from "../../shared/visitProtocol";

// Muse Visits (Task 4), the sight half: frame shape, validation at the
// seam, and when a frame is due.

test("a frame is scaled to 480 on the long edge (Task 41) and never upscaled", () => {
  expect(frameDimensions(1920, 1080)).toEqual({ width: 480, height: 270, scale: 0.25 });
  expect(frameDimensions(1080, 2340)).toEqual({ width: 222, height: 480, scale: 480 / 2340 });
  expect(frameDimensions(400, 300)).toEqual({ width: 400, height: 300, scale: 1 });
  expect(frameDimensions(0, 0).width).toBe(2);
  expect(FRAME_MAX_EDGE).toBe(480);
});

test("validation wants a real JPEG head under the byte cap", () => {
  const good = `data:image/jpeg;base64,/9j/${"A".repeat(400)}`;
  const check = validateFrameDataUrl(good);
  expect(check.ok).toBe(true);
  expect(check.ok && check.bytes).toBe(base64Bytes(`/9j/${"A".repeat(400)}`));
  expect(validateFrameDataUrl("data:image/png;base64,iVBORw0KGgo=")).toEqual({ ok: false, error: "a frame is a JPEG data URL" });
  expect(validateFrameDataUrl("data:image/jpeg;base64,iVBORw0KGgo=")).toEqual({ ok: false, error: "not a JPEG head" });
  expect(validateFrameDataUrl("data:image/jpeg;base64,/9j/<script>")).toEqual({ ok: false, error: "not base64" });
  expect(validateFrameDataUrl(42)).toEqual({ ok: false, error: "a frame is a data URL string" });
  const huge = `data:image/jpeg;base64,/9j/${"A".repeat(Math.ceil((FRAME_MAX_BYTES * 4) / 3) + 8)}`;
  expect(validateFrameDataUrl(huge)).toEqual({ ok: false, error: `frame over ${FRAME_MAX_BYTES} bytes` });
  expect(base64Bytes("QUJD")).toBe(3);
  expect(base64Bytes("QUI=")).toBe(2);
  expect(base64Bytes("QQ==")).toBe(1);
});

test("the first frame is prompt, a look is prompt, nothing else unless a caller opts into a cadence (Task 41), and the background takes none", () => {
  const now = 5_000_000;
  expect(frameDue({ lastFrameAt: null, now, lookRequested: false, foreground: true })).toBe(true);
  expect(frameDue({ lastFrameAt: now - 1000, now, lookRequested: false, foreground: true })).toBe(false);
  expect(frameDue({ lastFrameAt: now - 1000, now, lookRequested: true, foreground: true })).toBe(true);
  // No periodic frames by default, however long it has been...
  expect(frameDue({ lastFrameAt: now - 10 * FRAME_CADENCE_MS, now, lookRequested: false, foreground: true })).toBe(false);
  // ...unless the caller opts in.
  expect(frameDue({ lastFrameAt: now - FRAME_CADENCE_MS, now, lookRequested: false, foreground: true, cadenceMs: FRAME_CADENCE_MS })).toBe(true);
  expect(frameDue({ lastFrameAt: null, now, lookRequested: true, foreground: false })).toBe(false);
  expect(FRAME_CADENCE_MS).toBe(60_000);
});

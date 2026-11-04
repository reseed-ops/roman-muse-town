/**
 * Visit frames (Task 4, Nov 2026): the sight half's pure rules. A
 * frame is a still of the renderer's canvas only, never a page
 * element; capped at FRAME_MAX_EDGE on the long edge, JPEG at
 * FRAME_JPEG_QUALITY, about one every FRAME_CADENCE_MS while a visit
 * is open and the town is in the foreground, the first promptly, plus
 * one on a director's look. The validator keeps a frame honest at the
 * seam: a real JPEG head and a decoded byte cap.
 */
import { FRAME_CADENCE_MS, FRAME_MAX_BYTES, FRAME_MAX_EDGE } from "../../shared/visitProtocol";

/** Scale a canvas down so its long edge is at most maxEdge. Never up. */
export function frameDimensions(width: number, height: number, maxEdge = FRAME_MAX_EDGE): { width: number; height: number; scale: number } {
  const long = Math.max(width, height);
  if (long <= 0) return { width: 2, height: 2, scale: 1 };
  const scale = Math.min(1, maxEdge / long);
  return {
    width: Math.max(2, Math.round(width * scale)),
    height: Math.max(2, Math.round(height * scale)),
    scale,
  };
}

const JPEG_DATA_URL_HEAD = "data:image/jpeg;base64,";

/** Decoded byte length of a base64 payload, without decoding it. */
export function base64Bytes(b64: string): number {
  const len = b64.length;
  if (len === 0) return 0;
  let pad = 0;
  if (b64.endsWith("==")) pad = 2;
  else if (b64.endsWith("=")) pad = 1;
  return Math.floor((len * 3) / 4) - pad;
}

export type FrameCheck = { ok: true; bytes: number } | { ok: false; error: string };

/** A frame is a JPEG data URL (the base64 of 0xFFD8FF begins "/9j/")
 *  no larger than FRAME_MAX_BYTES decoded. */
export function validateFrameDataUrl(dataUrl: unknown, maxBytes = FRAME_MAX_BYTES): FrameCheck {
  if (typeof dataUrl !== "string") return { ok: false, error: "a frame is a data URL string" };
  if (!dataUrl.startsWith(JPEG_DATA_URL_HEAD)) return { ok: false, error: "a frame is a JPEG data URL" };
  const b64 = dataUrl.slice(JPEG_DATA_URL_HEAD.length);
  if (!b64.startsWith("/9j/")) return { ok: false, error: "not a JPEG head" };
  if (!/^[A-Za-z0-9+/]+=*$/.test(b64)) return { ok: false, error: "not base64" };
  const bytes = base64Bytes(b64);
  if (bytes > maxBytes) return { ok: false, error: `frame over ${maxBytes} bytes` };
  return { ok: true, bytes };
}

/** Is a frame due this beat? The first frame of a visit is prompt, a
 *  look request is prompt, otherwise the cadence; and never while the
 *  town is in the background (the view is not his view then). */
export function frameDue(input: { lastFrameAt: number | null; now: number; lookRequested: boolean; foreground: boolean; cadenceMs?: number }): boolean {
  if (!input.foreground) return false;
  if (input.lookRequested) return true;
  if (input.lastFrameAt === null) return true;
  return input.now - input.lastFrameAt >= (input.cadenceMs ?? FRAME_CADENCE_MS);
}

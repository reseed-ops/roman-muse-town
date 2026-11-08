/**
 * Visit frames (Task 4, Nov 2026): the sight half's pure rules. A
 * frame is a still of the renderer's canvas only, never a page
 * element; capped at FRAME_MAX_EDGE on the long edge, JPEG at
 * FRAME_JPEG_QUALITY, the first promptly when a visit opens, then one
 * on each director's look (Task 41: no periodic frames by default). The validator keeps a frame honest at the
 * seam: a real JPEG head and a decoded byte cap.
 */
import { FRAME_CADENCE_MS, FRAME_MAX_EDGE } from "../../shared/visitProtocol";

// The validator (a real JPEG head, the decoded byte cap) is protocol:
// the harness and the Live Bridge's face check frames at their doors
// with the same function, so it lives in shared/visitProtocol.ts and
// is re-exported here for the client's callers.
export { base64Bytes, validateFrameDataUrl, type FrameCheck } from "../../shared/visitProtocol";

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

/** Is a frame due this beat? The first frame of a visit is prompt, a
 *  look request is prompt, and nothing else (Task 41: a phone does not
 *  spend a JPEG encode and an upload on a view nobody asked to see) unless
 *  a caller opts into a periodic cadence; never while the town is in the
 *  background (the view is not his view then). */
export function frameDue(input: { lastFrameAt: number | null; now: number; lookRequested: boolean; foreground: boolean; cadenceMs?: number }): boolean {
  if (!input.foreground) return false;
  if (input.lookRequested) return true;
  if (input.lastFrameAt === null) return true;
  return input.cadenceMs !== undefined && input.now - input.lastFrameAt >= input.cadenceMs;
}
/** The periodic cadence, for a caller that opts in. */
export const OPT_IN_FRAME_CADENCE_MS = FRAME_CADENCE_MS;

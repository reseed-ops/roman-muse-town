/**
 * The director channel (Task 6, Nov 2026): one narrow interface through
 * which the Live Bridge reads a visit and leaves directions. Two
 * adapters implement it: Adapter A over this line's Task 4 seam harness
 * (seamAdapter.ts), and Adapter B, the serving face the town client
 * calls out to during a visit (slateFace.ts over bridgeServer.ts, Task
 * 7). Tests use the fake channel (fakeChannel.ts).
 *
 * The surface is slate-only by construction: state, inbox, one frame,
 * directions, the composing flag, and the context pack. There is no
 * method here that could reach facts, letters, bond, or digest, so the
 * director process is never handed a write path to them.
 */
import type { DirectorPack, VisitDirection, VisitFrame, VisitMail, VisitStateView } from "../../shared/visitProtocol.js";

export type ChannelState = VisitStateView & {
  /** The town's client has not reported for a stretch (harness only). */
  stale?: boolean;
};

export type DirectResult = { ok: true; id: number } | { ok: false; error: string };

export interface DirectorChannel {
  readState(): Promise<ChannelState>;
  readInbox(since: number): Promise<VisitMail[]>;
  /** One frame at a time: by id, or the latest when omitted. */
  readFrame(id?: number): Promise<VisitFrame | null>;
  direct(direction: VisitDirection): Promise<DirectResult>;
  setComposing(on: boolean): Promise<void>;
  /** The context pack kept town-side (readable through the seam). */
  readPack(): Promise<DirectorPack | null>;
}

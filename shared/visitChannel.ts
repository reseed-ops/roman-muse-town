/**
 * The director channel (Task 6, Nov 2026): one narrow interface through
 * which a director reads a visit and leaves directions. Adapters: A over
 * this line's Task 4 seam harness (bridge/src/seamAdapter.ts); B, the
 * serving face the town client calls out to during a visit
 * (shared/slateFace.ts behind bridge/src/bridgeServer.ts, Task 7, and
 * behind the hosted town's own door, web/, Task 8); and the bridge's
 * town channel that calls that door (bridge/src/townChannel.ts). Tests
 * use the fake channel (bridge/src/fakeChannel.ts).
 *
 * The surface is slate-only by construction: state, inbox, one frame,
 * directions, the composing flag, and the context pack. There is no
 * method here that could reach facts, letters, bond, or digest, so a
 * director process is never handed a write path to them.
 */
import type { DirectorPack, VisitDirection, VisitFrame, VisitMail, VisitStateView } from "./visitProtocol.js";

export type ChannelState = VisitStateView & {
  /** The town's client has not reported for a stretch (harness only). */
  stale?: boolean;
  /** The visit is open but the town's tab is away (backgrounded on a
   *  phone, or reloading): directions queue and wait for it (Task 33). */
  background?: boolean;
  /** The town's own derived facts about the visitor, from the hosted door (Task 62): a rank the bridge trusts for a paired town. */
  entitlement?: { rank: number };
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

/**
 * The town channel (Task 8): the director channel over the hosted
 * town's own door. The Live Bridge calls the town's action route with
 * the service's DIRECTOR_TOKEN and one visitor's token, and reads that
 * visitor's slate face through the locked visit actions
 * (server/src/visitActions.ts); the visitor's client feeds the same
 * face through its bridge leg against its own origin. The director
 * loop is untouched: it sees one more DirectorChannel.
 *
 * Both tokens travel in headers only and are never logged. A call that
 * fails throws, and the director folds a dead channel quietly.
 */
import { DIRECTOR_TOKEN_HEADER, VISITOR_TOKEN_HEADER, type DirectorPack, type DoorAction, type VisitDirection, type VisitFrame, type VisitMail } from "../../shared/visitProtocol.js";
import type { ChannelState, DirectResult, DirectorChannel } from "./channel.js";

export type TownChannelOptions = {
  /** The hosted town's origin, e.g. https://town.reseed.net */
  townUrl: string;
  directorToken: string;
  /** The one visitor whose town this director directs. */
  visitorToken: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

export function createTownChannel(opts: TownChannelOptions): DirectorChannel {
  const base = opts.townUrl.replace(/\/+$/, "");
  const timeoutMs = opts.timeoutMs ?? 4000;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const call = async (action: DoorAction, args: Record<string, unknown> = {}): Promise<unknown> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(`${base}/actions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          [DIRECTOR_TOKEN_HEADER]: opts.directorToken,
          [VISITOR_TOKEN_HEADER]: opts.visitorToken,
        },
        body: JSON.stringify({ action, args }),
        signal: controller.signal,
      });
      const text = await res.text();
      if (res.status !== 200) throw new Error(`${action}: HTTP ${res.status}`);
      const body = (text ? JSON.parse(text) : null) as { result?: unknown } | null;
      if (!body || !("result" in body)) throw new Error(`${action}: no result`);
      return body.result;
    } finally {
      clearTimeout(timer);
    }
  };
  return {
    async readState() {
      const view = (await call("visitstate", { since: 0 })) as { state: ChannelState; entitlement?: { rank?: unknown } };
      const rank = view.entitlement?.rank;
      return typeof rank === "number" && Number.isInteger(rank) && rank >= 0 && rank <= 10 ? { ...view.state, entitlement: { rank } } : view.state;
    },
    async readInbox(since) {
      const view = (await call("visitstate", { since })) as { mail: VisitMail[] };
      return view.mail;
    },
    async readFrame(id) {
      const got = (await call("visitframeget", id === undefined ? {} : { id })) as { frame: VisitFrame | null };
      return got.frame;
    },
    async direct(direction: VisitDirection) {
      return (await call("visitdirect", { direction })) as DirectResult;
    },
    async setComposing(on) {
      await call("visitcomposing", { on });
    },
    async readPack(): Promise<DirectorPack | null> {
      // The pack lives beside the bridge (pack.ts), not on the town.
      return null;
    },
  };
}

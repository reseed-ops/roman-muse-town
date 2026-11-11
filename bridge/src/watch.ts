/**
 * The visit watcher's subscriber (Task 66, hardened in Task 67): the box dials
 * OUT to the bridge (Railway cannot dial in), holds one server-sent-events
 * stream open on GET /principal/events, and is told soon after a line lands,
 * instead of waking once a minute. It is the recipe for the owner's side.
 *
 *   BRIDGE_URL=https://town-bridge-production.up.railway.app \
 *   PRINCIPAL_TOKEN=... bun run bridge/src/watch.ts
 *
 * This is best-effort notification with retries, NOT exactly-once delivery:
 * a line can reach `onLine` more than once (a restart before the state was
 * written, a command that posted and then failed), and a burst can be
 * coalesced to its newest state. What makes that safe is on the other side of
 * the call: `onLine` must fetch a fresh slate and make the wake call with the
 * marker's `visit` and `seen`, which the desk treats as idempotent (a repeat
 * for an answered line sends nothing).
 * - The stream carries the waiting marker only (numbers, times, flags; never
 *   text). The marker is STATE, not a queue: every (re)connect begins with the
 *   current marker, so a line that landed while the stream was down arrives as
 *   the first event after it returns.
 * - A once-a-minute poll of GET /principal/waiting runs beside the stream
 *   (the old fallback, kept). Both feed one `deliver`.
 * - Dedupe is by WORK IDENTITY, the pair (visit, line number), never by the
 *   line number alone: a new visit with the same number is new work. Every
 *   marker carries a `rev` that only rises; one older than a marker already
 *   applied (a poll answer that arrives after a newer push) is discarded.
 *   The last acknowledged work is written to `persist` (metadata, no text),
 *   so a restart does not repeat it.
 * - One command at a time, with a deadline (`commandTimeoutMs`) and an abort
 *   signal; while it runs, only the newest marker is kept (coalesced), and a
 *   stuck or failed command never blocks the chain. A line stays unseen after
 *   a failure, so the next event or poll retries it.
 * - A claiming watcher stops asking for the claim (it reconnects without
 *   `claim=1`) after repeated failures or a stuck command; the bridge also
 *   stops honouring heartbeats 10 minutes after her last real wake call.
 * - A stream silent for `idleMs` (45 s; the bridge beats every 15 s) is
 *   aborted and reconnected, with exponential backoff and jitter (1 s
 *   doubling to 30 s, reset by a good event). The bridge ends a stream at
 *   10 minutes, and sooner if its credential stops holding.
 * - `onLine` is where the owner's side wakes Muse: the usual POST
 *   /principal/wake {"seen": seq, "visit": visit, ...} (her words go through
 *   the shared gate; nothing here bypasses it). The default CLI prints one
 *   JSON line (metadata, no text) and, with WATCH_CMD set, runs that command
 *   with MUSE_LINE_SEQ and MUSE_VISIT in its environment.
 * - Nothing here logs a token or any text.
 */
import type { WaitingMarker } from "./principal.js";
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type SseEvent = { event: string; data: string };

/** An incremental SSE parser: feed chunks, get whole events; comments are dropped. */
export function createSseParser(onEvent: (e: SseEvent) => void): (chunk: string) => void {
  let buf = "";
  let event = "message";
  let data: string[] = [];
  return (chunk) => {
    buf += chunk;
    let at: number;
    while ((at = buf.search(/\r\n|\n|\r/)) >= 0) {
      const line = buf.slice(0, at);
      buf = buf.slice(at + (buf.startsWith("\r\n", at) ? 2 : 1));
      if (line === "") {
        if (data.length) onEvent({ event, data: data.join("\n") });
        event = "message";
        data = [];
      } else if (line.startsWith(":")) {
        /* a comment: the keepalive */
      } else {
        const i = line.indexOf(":");
        const field = i < 0 ? line : line.slice(0, i);
        const value = i < 0 ? "" : line.slice(i + 1).replace(/^ /, "");
        if (field === "event") event = value;
        else if (field === "data") data.push(value);
      }
    }
  };
}

/** The last work handed over and acknowledged: (visit, line number). Metadata only. */
export type Ack = { visit: number | null; seq: number };
export type WatchStore = { load(): Ack | null; save(ack: Ack): void };

/** `receivedAt`: when this process took the marker off the stream or poll (before it waited its turn);
 *  `startedAt`: when the callback began, which can be later while another command was running. */
export type LineContext = { visit: number | null; seq: number; receivedAt: number; startedAt: number; signal: AbortSignal };

export type WatchOptions = {
  bridgeUrl: string;
  token: string;
  /** The marker token cannot claim; set false to watch without asking for the claim. */
  claim?: boolean;
  /**
   * What counts as work. Default: a line that WAITS for her (the claim is hers). With
   * `lines`, any new line in an open visit counts, claimed or not, so a watcher that
   * does not claim still learns a line exists (the marker's `latestSeq`).
   */
  work?: "waiting" | "lines";
  /** Called once per work item; may be async. A throw, or passing the deadline, leaves it unseen. */
  onLine: (marker: WaitingMarker, ctx: LineContext) => void | Promise<void>;
  /** Where the last acknowledged work is kept across restarts (default: memory only). */
  persist?: WatchStore;
  pollFallbackMs?: number;
  backoffMs?: { min: number; max: number };
  /** A stream with no bytes (not even a keepalive) for this long is dropped and reconnected. */
  idleMs?: number;
  /** One `onLine` may run this long before it is aborted and counted as a failure. */
  commandTimeoutMs?: number;
  /** After this many failures in a row, or a command stuck longer than `claimStuckMs`, stop asking for the claim. */
  claimFailureLimit?: number;
  claimStuckMs?: number;
  fetchImpl?: typeof fetch;
  /** Progress words only: never a token or a line's text. */
  log?: (line: string) => void;
};

export type Watcher = {
  stop(): void;
  stats(): { streams: number; pushed: number; polled: number; failures: number; stale: number; coalesced: number };
};

export function startWatch(opts: WatchOptions): Watcher {
  const base = opts.bridgeUrl.replace(/\/+$/, "");
  const fetchImpl = opts.fetchImpl ?? fetch;
  const log = opts.log ?? (() => {});
  const wantsClaim = opts.claim !== false;
  const backoff = opts.backoffMs ?? { min: 1000, max: 30_000 };
  const idleMs = opts.idleMs ?? 45_000;
  const commandTimeoutMs = opts.commandTimeoutMs ?? 120_000;
  const claimFailureLimit = opts.claimFailureLimit ?? 3;
  const claimStuckMs = opts.claimStuckMs ?? 60_000;
  const headers = { authorization: `Bearer ${opts.token}` };
  let stopped = false;
  let ack: Ack | null = opts.persist?.load() ?? null;
  let lastRev = -Infinity;
  let pending: { m: WaitingMarker; via: "pushed" | "polled"; at: number } | null = null;
  let draining: Promise<void> | null = null;
  let current: AbortController | null = null;
  let failureStreak = 0;
  let stuck = false;
  const stats = { streams: 0, pushed: 0, polled: 0, failures: 0, stale: 0, coalesced: 0 };
  const aborters = new Set<AbortController>();

  /** Ask for the claim only while this responder is healthy. */
  const claimNow = () => wantsClaim && failureStreak < claimFailureLimit && !stuck;
  const query = () => (claimNow() ? "?claim=1" : "");
  const dropStreams = () => {
    for (const c of aborters) c.abort(); // the loop reconnects, and asks again with the current health
  };

  const workOf = (m: WaitingMarker): number | null => {
    if (opts.work === "lines") return m.visit !== null && m.latestSeq > 0 ? m.latestSeq : null;
    return m.waiting && m.seq !== null ? m.seq : null;
  };
  const isNew = (m: WaitingMarker, seq: number) => ack === null || ack.visit !== m.visit || seq > ack.seq;

  const handle = async (m: WaitingMarker, via: "pushed" | "polled", receivedAt: number) => {
    const seq = workOf(m);
    if (seq === null || !isNew(m, seq)) return;
    const ctl = new AbortController();
    current = ctl;
    const timer = setTimeout(() => ctl.abort(), commandTimeoutMs);
    const stuckTimer = setTimeout(() => {
      if (!stuck && wantsClaim) {
        stuck = true;
        log("watch: the command is slow; no longer asking for the claim");
        dropStreams();
      }
    }, claimStuckMs);
    try {
      const gone = new Promise<never>((_, reject) => ctl.signal.addEventListener("abort", () => reject(new Error("deadline or stop"))));
      await Promise.race([Promise.resolve().then(() => opts.onLine(m, { visit: m.visit, seq, receivedAt, startedAt: Date.now(), signal: ctl.signal })), gone]);
      ack = { visit: m.visit, seq };
      try {
        opts.persist?.save(ack);
      } catch {
        log("watch: could not write the state file; a restart may repeat this line");
      }
      stats[via] += 1;
      failureStreak = 0;
    } catch {
      stats.failures += 1;
      failureStreak += 1;
      log("watch: delivering a line failed or timed out; it stays unseen and is retried");
      if (wantsClaim && failureStreak === claimFailureLimit) {
        log("watch: repeated failures; no longer asking for the claim");
        dropStreams();
      }
    } finally {
      clearTimeout(timer);
      clearTimeout(stuckTimer);
      if (stuck && failureStreak === 0) stuck = false;
      current = null;
    }
  };

  const drain = async () => {
    while (pending && !stopped) {
      const { m, via, at } = pending;
      pending = null;
      await handle(m, via, at);
    }
    draining = null;
  };

  const deliver = (m: WaitingMarker, via: "pushed" | "polled"): Promise<void> => {
    // An older marker than one already applied (a poll answer that arrives after a newer push) is discarded.
    if (typeof m.rev === "number") {
      if (m.rev < lastRev) {
        stats.stale += 1;
        return draining ?? Promise.resolve();
      }
      lastRev = m.rev;
    }
    if (pending) stats.coalesced += 1; // state, not a queue: only the newest waits its turn
    pending = { m, via, at: pending && pending.m.seq === m.seq && pending.m.visit === m.visit ? pending.at : Date.now() };
    if (!draining) draining = drain();
    return draining;
  };

  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  const streamLoop = async () => {
    let wait = backoff.min;
    while (!stopped) {
      const ctl = new AbortController();
      aborters.add(ctl);
      let idle: ReturnType<typeof setTimeout> | null = null;
      const bump = () => {
        if (idle) clearTimeout(idle);
        idle = setTimeout(() => {
          log("watch: the stream went silent; reconnecting");
          ctl.abort();
        }, idleMs);
      };
      try {
        bump();
        const res = await fetchImpl(`${base}/principal/events${query()}`, { headers, signal: ctl.signal });
        if (res.status !== 200 || !res.body) {
          log(`watch: stream refused (HTTP ${res.status}); polling continues`);
          await res.body?.cancel().catch(() => {});
        } else {
          stats.streams += 1;
          log("watch: stream open");
          const parse = createSseParser((e) => {
            if (e.event !== "marker") return;
            try {
              const m = JSON.parse(e.data) as WaitingMarker;
              wait = backoff.min;
              void deliver(m, "pushed");
            } catch {
              /* a malformed event is ignored */
            }
          });
          const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            bump();
            parse(value);
          }
          log("watch: stream ended");
        }
      } catch (error) {
        if (!stopped) log(`watch: stream dropped (${error instanceof Error ? error.name : "error"})`);
      } finally {
        if (idle) clearTimeout(idle);
        aborters.delete(ctl);
      }
      if (stopped) return;
      await sleep(wait * (0.75 + Math.random() * 0.5));
      wait = Math.min(backoff.max, wait * 2);
    }
  };

  const pollOnce = async () => {
    try {
      const res = await fetchImpl(`${base}/principal/waiting${query()}`, { headers, signal: AbortSignal.timeout(10_000) });
      if (res.status === 200) await deliver((await res.json()) as WaitingMarker, "polled");
      else log(`watch: poll refused (HTTP ${res.status})`);
    } catch {
      log("watch: poll failed; tries again next time");
    }
  };
  const pollEvery = opts.pollFallbackMs ?? 60_000;
  const poller = setInterval(() => void pollOnce(), pollEvery);
  void pollOnce();
  void streamLoop();

  return {
    stop() {
      stopped = true;
      clearInterval(poller);
      pending = null;
      current?.abort();
      for (const c of aborters) c.abort();
    },
    stats: () => ({ ...stats }),
  };
}

/** The acknowledged work kept in a small JSON file (a visit number and a line number, no text). */
export function fileStore(path: string): WatchStore {
  return {
    load() {
      try {
        const v = JSON.parse(readFileSync(path, "utf8")) as Partial<Ack>;
        return typeof v.seq === "number" && (v.visit === null || typeof v.visit === "number") ? { visit: v.visit ?? null, seq: v.seq } : null;
      } catch {
        return null;
      }
    },
    save(ack) {
      writeFileSync(path, JSON.stringify(ack), { mode: 0o600 });
    },
  };
}

if (import.meta.main) {
  const bridgeUrl = process.env.BRIDGE_URL;
  const token = process.env.PRINCIPAL_TOKEN || process.env.PRINCIPAL_MARKER_TOKEN;
  if (!bridgeUrl || !token) {
    console.error("watch: set BRIDGE_URL and PRINCIPAL_TOKEN (or PRINCIPAL_MARKER_TOKEN, which cannot claim)");
    process.exit(2);
  }
  const cmd = process.env.WATCH_CMD;
  startWatch({
    bridgeUrl,
    token,
    claim: !!process.env.PRINCIPAL_TOKEN,
    // WATCH_WORK=lines: any new line is work (for a watcher that does not hold the claim).
    work: process.env.WATCH_WORK === "lines" ? "lines" : "waiting",
    persist: fileStore(process.env.WATCH_STATE || join(homedir(), ".muse-watch-state.json")),
    pollFallbackMs: Number(process.env.WATCH_POLL_S) > 0 ? Number(process.env.WATCH_POLL_S) * 1000 : 60_000,
    commandTimeoutMs: Number(process.env.WATCH_CMD_TIMEOUT_S) > 0 ? Number(process.env.WATCH_CMD_TIMEOUT_S) * 1000 : 120_000,
    log: (l) => console.error(l),
    onLine: (m, ctx) => {
      // Metadata only: the line's number, its visit, when the bridge first observed it, when this box took the marker, when the callback began.
      console.log(JSON.stringify({ line: ctx.seq, visit: ctx.visit, bridgeFirstObservedAt: m.lastLineAt, receivedAt: ctx.receivedAt, callbackStartedAt: ctx.startedAt }));
      if (!cmd) return;
      return new Promise<void>((resolve, reject) => {
        const env: Record<string, string | undefined> = { ...process.env, MUSE_LINE_SEQ: String(ctx.seq), MUSE_VISIT: ctx.visit === null ? "" : String(ctx.visit) };
        delete env.PRINCIPAL_TOKEN;
        delete env.PRINCIPAL_MARKER_TOKEN;
        const child = spawn(cmd, { shell: true, stdio: "inherit", env, signal: ctx.signal });
        child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("exit"))));
        child.on("error", reject);
      });
    },
  });
}

/**
 * The visit watcher's subscriber (Task 66): the box dials OUT to the bridge
 * (Railway cannot dial in), holds one server-sent-events stream open on
 * GET /principal/events, and is told the moment a line lands, instead of
 * waking once a minute. It is the recipe for the owner's side of the wire.
 *
 *   BRIDGE_URL=https://town-bridge-production.up.railway.app \
 *   PRINCIPAL_TOKEN=... bun run bridge/src/watch.ts
 *
 * What it does, and why it cannot lose or double a line:
 * - The stream carries the waiting marker only (a number, a time, the
 *   composing flag; never text). The marker is STATE, not a queue: every
 *   (re)connect begins with the current marker, so a line that landed
 *   while the stream was down arrives as the first event after it returns.
 * - A once-a-minute poll of GET /principal/waiting runs beside the stream
 *   (the old fallback, kept): if the stream is blocked or dead, the poll
 *   still delivers within the minute. Both feed the same `deliver`, which
 *   hands each line number to `onLine` once (`seen`), so push and poll
 *   never produce two deliveries. A failed `onLine` leaves the line unseen,
 *   so the next event or poll retries it.
 * - Reconnect with exponential backoff and jitter (1 s doubling to 30 s,
 *   reset by a good event). The bridge ends a stream every 10 minutes to
 *   re-check the token; the watcher just reconnects.
 * - `onLine` is where the owner's side wakes Muse: it should make the usual
 *   POST /principal/wake {"seen": marker.seq, ...} (the wake is what carries
 *   her words, through the shared gate; nothing here bypasses it). The
 *   default CLI prints one JSON line (the marker, no text) and, with
 *   WATCH_CMD set, runs that command with MUSE_LINE_SEQ in its environment.
 * - Nothing here logs a token or any text.
 */
import type { WaitingMarker } from "./principal.js";
import { spawn } from "node:child_process";

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

export type WatchOptions = {
  bridgeUrl: string;
  token: string;
  /** The marker token cannot claim; set false to watch without holding the visit. */
  claim?: boolean;
  /** Called once per waiting line number; may be async. A throw leaves the line unseen. */
  onLine: (marker: WaitingMarker) => void | Promise<void>;
  pollFallbackMs?: number;
  backoffMs?: { min: number; max: number };
  fetchImpl?: typeof fetch;
  /** Progress words only: never a token or a line's text. */
  log?: (line: string) => void;
};

export type Watcher = { stop(): void; stats(): { streams: number; pushed: number; polled: number; failures: number } };

export function startWatch(opts: WatchOptions): Watcher {
  const base = opts.bridgeUrl.replace(/\/+$/, "");
  const fetchImpl = opts.fetchImpl ?? fetch;
  const log = opts.log ?? (() => {});
  const claim = opts.claim !== false ? "claim=1" : "";
  const backoff = opts.backoffMs ?? { min: 1000, max: 30_000 };
  const headers = { authorization: `Bearer ${opts.token}` };
  let stopped = false;
  let seen = 0;
  let delivering: Promise<void> = Promise.resolve();
  const stats = { streams: 0, pushed: 0, polled: 0, failures: 0 };
  const aborters = new Set<AbortController>();

  const deliver = (m: WaitingMarker, via: "pushed" | "polled"): Promise<void> => {
    // Serialised, so a push and a poll that land together hand over one line once.
    delivering = delivering.then(async () => {
      if (m.seq !== null && m.seq < seen) seen = 0; // numbers went backward: a new visit began
      if (!m.waiting) {
        if (seen !== 0 && m.seq === null) seen = 0;
        return;
      }
      if (m.seq === null || m.seq <= seen) return;
      try {
        await opts.onLine(m);
        seen = m.seq;
        stats[via] += 1;
      } catch {
        stats.failures += 1;
        log("watch: delivering a line failed; it stays unseen and is retried");
      }
    });
    return delivering;
  };

  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  const streamLoop = async () => {
    let wait = backoff.min;
    while (!stopped) {
      const ctl = new AbortController();
      aborters.add(ctl);
      try {
        const res = await fetchImpl(`${base}/principal/events${claim ? `?${claim}` : ""}`, { headers, signal: ctl.signal });
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
            parse(value);
          }
          log("watch: stream ended");
        }
      } catch (error) {
        if (!stopped) log(`watch: stream dropped (${error instanceof Error ? error.name : "error"})`);
      } finally {
        aborters.delete(ctl);
      }
      if (stopped) return;
      await sleep(wait * (0.75 + Math.random() * 0.5));
      wait = Math.min(backoff.max, wait * 2);
    }
  };

  const pollOnce = async () => {
    try {
      const res = await fetchImpl(`${base}/principal/waiting${claim ? `?${claim}` : ""}`, { headers, signal: AbortSignal.timeout(10_000) });
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
      for (const c of aborters) c.abort();
    },
    stats: () => ({ ...stats }),
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
    pollFallbackMs: Number(process.env.WATCH_POLL_S) > 0 ? Number(process.env.WATCH_POLL_S) * 1000 : 60_000,
    log: (l) => console.error(l),
    onLine: (m) => {
      console.log(JSON.stringify({ line: m.seq, at: m.at }));
      if (!cmd) return;
      return new Promise<void>((resolve, reject) => {
        const env: Record<string, string | undefined> = { ...process.env, MUSE_LINE_SEQ: String(m.seq) };
        delete env.PRINCIPAL_TOKEN;
        delete env.PRINCIPAL_MARKER_TOKEN;
        const child = spawn(cmd, { shell: true, stdio: "inherit", env });
        child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("exit"))));
        child.on("error", reject);
      });
    },
  });
}

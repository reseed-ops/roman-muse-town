/**
 * The resident director (Task 6): the poll-and-answer loop. While a
 * visit is open it polls the channel about every two seconds; new
 * inbox mail is answered first, streaming where the channel carries
 * partial lines; one greeting per visit; presence intentions throttled;
 * sight fetched on a look or a slow cadence, never every poll. The
 * output filter runs before any speak or intention is enqueued. Caps
 * are honored: over a cap, the director keeps reading but spends
 * nothing more. A dead channel folds quietly: the error is logged,
 * the next poll backs off, and nothing is thrown out of the loop. In
 * the off state the loop idles and a visit simply lapses by heartbeat.
 *
 * `tick()` is one poll, so the loop is tested step by step against the
 * fake channel and a scripted mind; `run()` strings ticks together.
 */
import type { VisitFrame, VisitMail, VisitTelemetry } from "../../shared/visitProtocol.js";
import type { DirectorChannel, ChannelState } from "./channel.js";
import type { CostLedger } from "./costCaps.js";
import type { Mind, ThreadTurn } from "./mind.js";
import { bandForRank, filterIntention, filterSpeak } from "./outputFilter.js";
import type { PackLoader } from "./pack.js";
import type { PrincipalDesk } from "./principal.js";

export type DirectorConfig = {
  enabled: boolean;
  pollMs: number;
  /** At most one presence intention per this many ms, and none before it. */
  intentionEveryMs: number;
  /** Look at the latest frame at most this often (a look request aside). */
  sightEveryMs: number;
  /** Ask the town for a look when the frame in hand is older than this at mail time. */
  staleFrameMs: number;
  /** Partial speak cadence; the final speak always follows. */
  partialEveryMs: number;
  greeting: string;
  /** The longest a dead channel backs off between polls. */
  maxBackoffMs: number;
};

export const DEFAULT_DIRECTOR_CONFIG: DirectorConfig = {
  enabled: true,
  pollMs: 2000,
  intentionEveryMs: 5 * 60 * 1000,
  sightEveryMs: 5 * 60 * 1000,
  staleFrameMs: 60 * 1000,
  partialEveryMs: 700,
  greeting: "There you are. I was hoping you'd come by.",
  maxBackoffMs: 60 * 1000,
};

export type DirectorDeps = {
  channel: DirectorChannel;
  mind: Mind;
  pack: PackLoader;
  ledger: CostLedger;
  config?: Partial<DirectorConfig>;
  now?: () => number;
  log?: (line: string) => void;
  sleep?: (ms: number) => Promise<void>;
  /** The principal channel (Task 22): while her claim lives, the resident only relays. */
  principal?: PrincipalDesk;
};

export type TickReport = {
  kind: "off" | "dead" | "closed" | "idle" | "answered" | "greeted" | "intended" | "capped" | "relayed";
  detail?: string;
  /** The delay the loop should wait before the next tick. */
  nextInMs: number;
};

type VisitMemory = {
  beganAt: number | null;
  greeted: boolean;
  lastSeq: number;
  thread: ThreadTurn[];
  lastIntentionAt: number;
  frame: VisitFrame | null;
  frameViewedAt: number;
  lookPending: boolean;
  lineCounter: number;
};

export type Director = {
  tick(): Promise<TickReport>;
  run(): Promise<void>;
  stop(): void;
  memory(): Readonly<VisitMemory> | null;
};

export function createDirector(deps: DirectorDeps): Director {
  const config: DirectorConfig = { ...DEFAULT_DIRECTOR_CONFIG, ...deps.config };
  const now = deps.now ?? (() => Date.now());
  const log = deps.log ?? ((line: string) => console.log(line));
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const { channel, mind, pack, ledger } = deps;
  let visit: VisitMemory | null = null;
  let failures = 0;
  let running = false;

  const freshVisit = (beganAt: number | null): VisitMemory => ({
    beganAt, greeted: false, lastSeq: 0, thread: [], lastIntentionAt: now(), frame: null, frameViewedAt: -Infinity, lookPending: false, lineCounter: 0,
  });
  const band = () => bandForRank(pack.current().rank ?? 0);
  const quiet = async <T>(what: string, work: () => Promise<T>): Promise<T | null> => {
    try {
      return await work();
    } catch (error) {
      log(`${what} failed: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  };
  const speak = async (text: string, lineId?: string, partial = false): Promise<boolean> => {
    const r = await quiet("speak", () => channel.direct({ kind: "speak", text, ...(lineId ? { lineId } : {}), ...(partial ? { partial: true } : {}) }));
    if (r?.ok && !partial) deps.principal?.noteResidentLine(text);
    return !!r && r.ok;
  };

  /** Sight, never on every poll: a look's answer, or the slow cadence. */
  const maybeViewFrame = async (state: ChannelState, v: VisitMemory, t: number, forMail: boolean): Promise<void> => {
    const latest = state.frames[state.frames.length - 1];
    if (!latest) return;
    const newer = !v.frame || latest.id > v.frame.id;
    const due = v.lookPending || t - v.frameViewedAt >= config.sightEveryMs || (forMail && t - v.frameViewedAt >= config.staleFrameMs);
    if (!newer || !due) return;
    if (!ledger.canViewFrame(t)) return;
    const frame = await quiet("readFrame", () => channel.readFrame(latest.id));
    if (!frame) return;
    v.frame = frame;
    v.frameViewedAt = t;
    v.lookPending = false;
    ledger.recordFrame(t);
  };

  const answer = async (state: ChannelState, v: VisitMemory, mail: VisitMail[], t: number): Promise<TickReport> => {
    v.lastSeq = mail[mail.length - 1]!.seq;
    for (const m of mail) v.thread.push({ who: "him", text: m.text });
    if (!ledger.canCall(t)) {
      log("cap reached: mail read, not answered");
      return { kind: "capped", nextInMs: config.pollMs };
    }
    await maybeViewFrame(state, v, t, true);
    // A frame in hand that is older than a minute: ask for a look so
    // the next answer sees the present.
    if (t - v.frameViewedAt > config.staleFrameMs && !v.lookPending) {
      const look = await quiet("look", () => channel.direct({ kind: "look" }));
      if (look?.ok) v.lookPending = true;
    }
    await quiet("composing", () => channel.setComposing(true));
    const lineId = `L${v.beganAt ?? 0}-${++v.lineCounter}`;
    const controller = new AbortController();
    let pending = "";
    let lastPartialAt = 0;
    let partials = 0;
    let composed: Awaited<ReturnType<Mind["compose"]>> | null = null;
    try {
      composed = await mind.compose(
        { pack: pack.current(), thread: v.thread, mail, telemetry: state.telemetry, intention: state.intention, frame: v.frame, signal: controller.signal },
        (delta) => {
          pending += delta;
          const tNow = now();
          if (tNow - lastPartialAt < config.partialEveryMs || partials >= 12) return;
          const partial = filterSpeak(pending, { band: band() });
          if (!partial.ok) return;
          lastPartialAt = tNow;
          partials += 1;
          void speak(partial.text, lineId, true);
          if (partial.notes.includes("capped")) controller.abort();
        },
      );
    } catch (error) {
      if (!controller.signal.aborted) log(`compose failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    const tEnd = now();
    if (composed) ledger.recordCall(tEnd, { outputTokens: composed.usage.outputTokens });
    const raw = composed && !composed.refused ? composed.text : pending || "";
    const final = filterSpeak(raw || "Give me a moment. Ask me that again another way.", { band: band() });
    const line = final.ok ? final.text : "Let me find better words for that in a moment.";
    if (!final.ok) log(`filter refused the line (${final.reason}); a soft line went instead`);
    await speak(line, lineId, false);
    v.thread.push({ who: "her", text: line });
    await quiet("composing", () => channel.setComposing(false));
    return { kind: "answered", detail: line, nextInMs: config.pollMs };
  };

  const tick = async (): Promise<TickReport> => {
    if (!config.enabled) return { kind: "off", nextInMs: config.maxBackoffMs };
    const t = now();
    let state: ChannelState;
    try {
      state = await channel.readState();
      failures = 0;
    } catch (error) {
      failures += 1;
      const backoff = Math.min(config.maxBackoffMs, config.pollMs * 2 ** Math.min(failures, 6));
      log(`channel unreachable (${error instanceof Error ? error.message : String(error)}); folding quietly, next look in ${backoff} ms`);
      return { kind: "dead", nextInMs: backoff };
    }
    // The principal's desk sees every poll, claimed or not, so it knows
    // the visit and his lines when she arrives.
    if (deps.principal) await quiet("principal", () => deps.principal!.observe(state));
    if (!state.active || state.stale) {
      if (visit) log("the visit closed; forgetting it");
      visit = null;
      return { kind: "closed", nextInMs: config.pollMs };
    }
    if (!visit || visit.beganAt !== state.beganAt) {
      visit = freshVisit(state.beganAt);
      visit.lastSeq = state.latestSeq; // mail from before this director arrived is not answered twice
      log(`a visit is open (began ${state.beganAt ?? "?"})`);
    }
    const v = visit;
    if (deps.principal?.live()) {
      // She attends: the resident composes nothing, not even a greeting,
      // and his lines from the claim are hers, not answered again later.
      v.greeted = true;
      v.lastSeq = state.latestSeq;
      v.lastIntentionAt = t;
      return { kind: "relayed", nextInMs: config.pollMs };
    }
    if (!v.greeted) {
      v.greeted = true;
      const greeting = filterSpeak(config.greeting, { band: band() });
      if (greeting.ok) {
        await speak(greeting.text);
        v.thread.push({ who: "her", text: greeting.text });
      }
      return { kind: "greeted", nextInMs: config.pollMs };
    }
    const mail = (await quiet("readInbox", () => channel.readInbox(v.lastSeq))) ?? [];
    if (mail.length > 0) return answer(state, v, mail, t);
    await maybeViewFrame(state, v, t, false);
    if (t - v.lastIntentionAt >= config.intentionEveryMs) {
      v.lastIntentionAt = t;
      if (!ledger.canCall(t)) return { kind: "capped", nextInMs: config.pollMs };
      const intent = await quiet("intend", () => mind.intend({ pack: pack.current(), thread: v.thread, telemetry: state.telemetry, intention: state.intention }));
      if (intent) {
        ledger.recordCall(now(), { outputTokens: intent.usage.outputTokens });
        const filtered = filterIntention(intent.text, { band: band() });
        if (filtered.ok) {
          await quiet("intend", () => channel.direct({ kind: "intend", text: filtered.text }));
          return { kind: "intended", detail: filtered.text, nextInMs: config.pollMs };
        }
      }
    }
    return { kind: "idle", nextInMs: config.pollMs };
  };

  return {
    tick,
    async run() {
      running = true;
      void pack.check();
      pack.start();
      while (running) {
        const report = await tick();
        if (report.kind !== "idle" && report.kind !== "closed" && report.kind !== "off" && report.kind !== "relayed") log(`${report.kind}${report.detail ? `: ${report.detail}` : ""}`);
        await sleep(report.nextInMs);
      }
      pack.stop();
    },
    stop() {
      running = false;
    },
    memory: () => visit,
  };
}

export type { VisitTelemetry };

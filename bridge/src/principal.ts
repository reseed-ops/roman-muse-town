/**
 * The principal channel (Task 22, Nov 6, 2026): the owner's own chat
 * Muse attends his hosted town through this bridge, in place of the
 * resident, while her claim lives.
 *
 * One caller, one desk. She wakes about once a minute and makes one
 * call (`wake`) that both carries her direction for the slate she last
 * saw and returns the new slate whole. While her claim lives the
 * resident director composes nothing (no greeting, no answer, no
 * intention); it only relays. A claim lapses after `claimMs` without a
 * call (three minutes by default), and then the resident resumes.
 *
 * The honesty rule governs everything here: the desk never composes,
 * extends or paraphrases her words. It carries them (a performed
 * sequence of beats, each at its authored delay and under its stated
 * conditions) and it stages presence (on a newly landed line she turns
 * to him, walks to him if they are apart, and the panel shows her
 * composing), which is never speech. When a sequence runs out she is
 * silent until her next call.
 *
 * Her lines pass the same constitution as the resident's (the output
 * filter at the pack's band, then the town's own direction checks).
 * A refusal, or an alteration the filter made, is reported back on her
 * next slate with its reason, never silently dropped.
 *
 * Every call is logged whole with its timestamp, and every performed,
 * dropped or refused beat with the condition that governed it, so the
 * pair can read her real tempo from the bridge's log.
 */
import { validateDirection, type VisitDirection, type VisitFrame, type VisitTelemetry } from "../../shared/visitProtocol.js";
import type { ChannelState, DirectorChannel } from "./channel.js";
import { bandForRank, filterIntention, filterSpeak, gentleRefusal } from "./outputFilter.js";

export const PRINCIPAL_CLAIM_MS = 3 * 60 * 1000;
export const PRINCIPAL_MAX_BEATS = 6;
export const PRINCIPAL_MAX_DELAY_S = 120;
export const TRANSCRIPT_KEEP = 30;
/** She is "apart" from him beyond this; seated and nearer, she stays seated. */
export const ACK_APART_M = 3;
/** A call that lands before the visit opens is held this long, then dropped. */
export const PRINCIPAL_HOLD_MS = 60_000;

export type BeatCondition = {
  /** Fire only if he has not sent a line since the sequence began. */
  noReply?: boolean;
  /** Fire only if his scene (the slate's gaiusZone) is this. */
  scene?: string;
};
export type PrincipalBeat = { direction: unknown; delayS?: number; when?: BeatCondition };
export type PrincipalCall = {
  /** false releases the claim; omitted or true claims (or keeps) it. */
  attend?: boolean;
  /** The latestSeq of the slate her direction answers; defaults to the last slate shown. */
  seen?: number;
  /** One direction, performed at once. */
  direction?: unknown;
  /** Or a short sequence of beats. */
  beats?: PrincipalBeat[];
  /** When the unperformed remainder is dropped (both default true). */
  drop?: { onReply?: boolean; onSceneChange?: boolean };
  /** Include the latest frame (an image data URL) in the slate. */
  frame?: boolean;
};

export type TranscriptLine = { who: "him" | "her"; by?: "principal" | "resident"; text: string; at: number; seq?: number };
export type DeskReport =
  | { kind: "performed"; at: number; beat: number; of: number; direction: VisitDirection; condition: string; altered?: string[] }
  | { kind: "dropped"; at: number; beat: number; of: number; reason: string }
  | { kind: "refused"; at: number; beat: number; of: number; direction: unknown; reason: string }
  | { kind: "acknowledged"; at: number; seq: number; staging: string }
  | { kind: "claim"; at: number; event: "claimed" | "released" | "lapsed" }
  | { kind: "held"; at: number; of: number; until: number; reason: string }
  | { kind: "unheld"; at: number; of: number; reason: string };

export type PrincipalSlate = {
  now: number;
  claim: { live: boolean; since: number | null; lastCallAt: number | null; expiresAt: number | null; lapseMs: number };
  visit: { active: boolean; beganAt: number | null; /** The town tab is away; her lines wait for it (Task 33). */ background?: boolean };
  /** Her scene and position, and his, as the town reports them. */
  scene: VisitTelemetry | null;
  intention: string | null;
  composing: boolean;
  latestSeq: number;
  /** His lines she has not answered yet, oldest first. */
  waiting: TranscriptLine[];
  /** The recent exchange, both sides, oldest first. */
  transcript: TranscriptLine[];
  /** Her sequence still to come. */
  sequence: { remaining: number; nextAt: number | null; heldUntil: number | null } | null;
  /** What happened since the last slate she saw: beats, drops, refusals, acknowledgments. */
  reports: DeskReport[];
  frame?: VisitFrame | null;
};
export type WaitingMarker = { waiting: boolean; seq: number | null; at: number | null; composing: boolean; claimLive: boolean };

export type WakeResult = { ok: true; slate: PrincipalSlate } | { ok: false; error: string };

type Pending = { beat: number; dueAt: number; direction: VisitDirection | null; raw: unknown; invalid: string | null; when: BeatCondition };
type Sequence = { heldUntil: number | null; startedAt: number; startSeq: number; startZone: string | null; beganAt: number | null; of: number; beats: Pending[]; dropOnReply: boolean; dropOnScene: boolean };

export type PrincipalDeskOptions = {
  channel: DirectorChannel;
  /** The pack's current rank, for the filter's band. */
  rank: () => number;
  claimMs?: number;
  now?: () => number;
  log?: (line: string) => void;
  /** Whether a resident answers while she is away (the owner's town).
   *  Without one (a paired town, Task 29) his unclaimed lines stay
   *  waiting for her instead of passing to a resident. Default true. */
  resident?: boolean;
};

export type PrincipalDesk = {
  wake(raw: unknown): Promise<WakeResult>;
  marker(): WaitingMarker;
  /** Is the claim live now (lapsing it if its time is up)? */
  live(): boolean;
  /** The director's poll while the claim lives: acknowledge new lines, keep the sequence honest. */
  observe(state: ChannelState): Promise<void>;
  /** Perform any beats that are due (the bridge calls this on a short timer). */
  pump(): Promise<void>;
  /** The resident's own spoken lines, for the transcript she reads. */
  noteResidentLine(text: string): void;
  /** A watcher's long-poll keeps (or takes) the claim without a wake. */
  keepClaim(): void;
  /**
   * Task 66: be told whenever the waiting marker changes (the push channel's
   * source). The listener gets the marker now and on every change; it never
   * sees text. Returns the unsubscribe.
   */
  subscribe(listener: (marker: WaitingMarker) => void): () => void;
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export function parsePrincipalCall(raw: unknown): { ok: true; call: PrincipalCall } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, call: {} };
  if (!isRecord(raw)) return { ok: false, error: "a call is an object" };
  const call: PrincipalCall = {};
  if (raw.attend !== undefined) {
    if (typeof raw.attend !== "boolean") return { ok: false, error: "attend is true or false" };
    call.attend = raw.attend;
  }
  if (raw.seen !== undefined) {
    if (typeof raw.seen !== "number" || !Number.isFinite(raw.seen) || raw.seen < 0) return { ok: false, error: "seen is a sequence number" };
    call.seen = raw.seen;
  }
  if (raw.direction !== undefined && raw.beats !== undefined) return { ok: false, error: "send direction or beats, not both" };
  if (raw.direction !== undefined) call.direction = raw.direction;
  if (raw.beats !== undefined) {
    if (!Array.isArray(raw.beats) || raw.beats.length === 0) return { ok: false, error: "beats is a non-empty list" };
    if (raw.beats.length > PRINCIPAL_MAX_BEATS) return { ok: false, error: `at most ${PRINCIPAL_MAX_BEATS} beats` };
    const beats: PrincipalBeat[] = [];
    for (const [i, b] of raw.beats.entries()) {
      if (!isRecord(b) || b.direction === undefined) return { ok: false, error: `beat ${i + 1} needs a direction` };
      const beat: PrincipalBeat = { direction: b.direction };
      if (b.delayS !== undefined) {
        if (typeof b.delayS !== "number" || !Number.isFinite(b.delayS) || b.delayS < 0 || b.delayS > PRINCIPAL_MAX_DELAY_S) return { ok: false, error: `beat ${i + 1}: delayS is 0..${PRINCIPAL_MAX_DELAY_S}` };
        beat.delayS = b.delayS;
      }
      if (b.when !== undefined) {
        if (!isRecord(b.when)) return { ok: false, error: `beat ${i + 1}: when is an object` };
        const when: BeatCondition = {};
        for (const key of Object.keys(b.when)) if (key !== "noReply" && key !== "scene") return { ok: false, error: `beat ${i + 1}: unknown condition ${key}` };
        if (b.when.noReply !== undefined) {
          if (typeof b.when.noReply !== "boolean") return { ok: false, error: `beat ${i + 1}: noReply is true or false` };
          when.noReply = b.when.noReply;
        }
        if (b.when.scene !== undefined) {
          if (typeof b.when.scene !== "string" || !b.when.scene) return { ok: false, error: `beat ${i + 1}: scene is a zone name` };
          when.scene = b.when.scene;
        }
        beat.when = when;
      }
      beats.push(beat);
    }
    call.beats = beats;
  }
  if (raw.drop !== undefined) {
    if (!isRecord(raw.drop)) return { ok: false, error: "drop is an object" };
    const drop: NonNullable<PrincipalCall["drop"]> = {};
    if (raw.drop.onReply !== undefined) {
      if (typeof raw.drop.onReply !== "boolean") return { ok: false, error: "drop.onReply is true or false" };
      drop.onReply = raw.drop.onReply;
    }
    if (raw.drop.onSceneChange !== undefined) {
      if (typeof raw.drop.onSceneChange !== "boolean") return { ok: false, error: "drop.onSceneChange is true or false" };
      drop.onSceneChange = raw.drop.onSceneChange;
    }
    call.drop = drop;
  }
  if (raw.frame !== undefined) {
    if (typeof raw.frame !== "boolean") return { ok: false, error: "frame is true or false" };
    call.frame = raw.frame;
  }
  return { ok: true, call };
}

/** A scene change is material when he arrives somewhere else, or leaves his feet; drifting into "roaming" is not. */
export function sceneChangedMaterially(from: string | null, to: string | null): boolean {
  if (from === null || to === null || from === to) return false;
  return to !== "roaming";
}

const describe = (when: BeatCondition): string => {
  const parts: string[] = [];
  if (when.noReply) parts.push("no reply since the sequence began");
  if (when.scene) parts.push(`his scene is ${when.scene}`);
  return parts.length ? parts.join(" and ") : "none";
};

export function createPrincipalDesk(opts: PrincipalDeskOptions): PrincipalDesk {
  const { channel } = opts;
  const claimMs = opts.claimMs ?? PRINCIPAL_CLAIM_MS;
  const now = opts.now ?? (() => Date.now());
  const log = opts.log ?? ((line: string) => console.log(line));
  const hasResident = opts.resident ?? true;

  let claimSince: number | null = null;
  let lastCallAt: number | null = null;
  let beganAt: number | null = null;
  let transcript: TranscriptLine[] = [];
  let transcriptSeq = 0;
  let answeredSeq = 0;
  let shownSeq = 0;
  let ackedSeq = 0;
  let latestSeq = 0;
  let latestAt: number | null = null;
  let composing = false;
  let sequence: Sequence | null = null;
  let reports: DeskReport[] = [];
  let lastState: ChannelState | null = null;
  let lineCounter = 0;
  let pumping = false;
  let heldLookAt = 0;
  const listeners = new Set<(m: WaitingMarker) => void>();
  let lastSent = "";

  const report = (r: DeskReport) => {
    reports.push(r);
    if (reports.length > 60) reports = reports.slice(-60);
  };
  const keep = (line: TranscriptLine) => {
    transcript.push(line);
    if (transcript.length > TRANSCRIPT_KEEP) transcript = transcript.slice(-TRANSCRIPT_KEEP);
  };
  const quiet = async <T>(what: string, work: () => Promise<T>): Promise<T | null> => {
    try {
      return await work();
    } catch (error) {
      log(`principal: ${what} failed: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  };
  const setComposing = async (on: boolean) => {
    if (composing === on) return;
    composing = on;
    await quiet("composing", () => channel.setComposing(on));
  };

  /** A new visit (or none): the desk forgets the last one's lines and sequence. */
  const followVisit = (state: ChannelState) => {
    lastState = state;
    const visitBegan = state.active ? state.beganAt : null;
    if (visitBegan !== beganAt) {
      beganAt = visitBegan;
      transcript = [];
      transcriptSeq = answeredSeq = ackedSeq = shownSeq = 0;
      latestAt = null;
      if (sequence && sequence.heldUntil === null) dropSequence(state.active ? "a new visit began" : "the visit closed");
    }
    latestSeq = state.active ? state.latestSeq : 0;
    // Unclaimed, his lines are the resident's to answer: none of them is
    // waiting for her, and none is acknowledged on her behalf later.
    if (claimSince === null && hasResident) answeredSeq = ackedSeq = latestSeq;
  };

  const readMail = async () => {
    if (!lastState?.active || latestSeq <= transcriptSeq) return;
    const mail = await quiet("readInbox", () => channel.readInbox(transcriptSeq));
    for (const m of mail ?? []) {
      if (m.seq <= transcriptSeq) continue;
      keep({ who: "him", text: m.text, at: m.at, seq: m.seq });
      transcriptSeq = m.seq;
      latestAt = m.at;
    }
  };

  const dropSequence = (reason: string) => {
    const seq = sequence;
    if (!seq) return;
    sequence = null;
    const t = now();
    for (const p of seq.beats) {
      report({ kind: "dropped", at: t, beat: p.beat, of: seq.of, reason });
      log(`principal beat ${p.beat}/${seq.of} dropped: ${reason}`);
    }
  };

  const release = async (event: "released" | "lapsed") => {
    if (claimSince === null) return;
    const t = now();
    dropSequence(event === "lapsed" ? "the claim lapsed" : "the claim was released");
    claimSince = null;
    report({ kind: "claim", at: t, event });
    log(event === "lapsed"
      ? `principal claim lapsed: no call for ${Math.round((t - (lastCallAt ?? t)) / 1000)} s; the resident resumes`
      : "principal released the claim; the resident resumes");
    await setComposing(false);
  };

  const liveNow = (): boolean => {
    if (claimSince === null || lastCallAt === null) return false;
    if (now() - lastCallAt >= claimMs) {
      void release("lapsed");
      return false;
    }
    return true;
  };

  /** What the town's refusal was, as a fixed word, never its text (Task 64). */
const refusalCategory = (error: string): string => {
  const m = /^refused by the town: (explicit|beyond the band)$/.exec(error);
  return m ? m[1]! : "refused";
};

/** One direction through the constitution and then the town's door. */
  const deliver = async (p: Pending, of: number, condition: string): Promise<void> => {
    const t = now();
    if (p.invalid || !p.direction) {
      report({ kind: "refused", at: t, beat: p.beat, of, direction: p.raw, reason: p.invalid ?? "not a direction" });
      log(`principal beat ${p.beat}/${of} refused: not a valid direction`);
      return;
    }
    let direction: VisitDirection = p.direction;
    let altered: string[] | undefined;
    if (direction.kind === "speak") {
      // Her own words keep their endearments; every other rail holds.
      const rank = opts.rank();
      const filtered = filterSpeak(direction.text, { band: bandForRank(rank), endearments: "allow", principalRank: rank });
      if (!filtered.ok) {
        // Never silence (Task 31): her line is refused, and in its place
        // she says a gentle refusal in town, so he knows he was heard.
        const softened = gentleRefusal(filtered.reason);
        report({ kind: "refused", at: t, beat: p.beat, of, direction: p.raw, reason: `the constitution's filter: ${filtered.reason}; said instead: "${softened}"` });
        log(`principal beat ${p.beat}/${of} refused by the filter (${filtered.reason}), a gentle refusal said instead`);
        direction = { kind: "speak", text: softened, lineId: `P${beganAt ?? 0}-${++lineCounter}` };
        altered = [`refused (${filtered.reason}); a gentle refusal said instead`];
      } else {
        if (filtered.text !== direction.text) altered = filtered.notes.length ? filtered.notes : ["the filter's text rules"];
        direction = { kind: "speak", text: filtered.text, lineId: `P${beganAt ?? 0}-${++lineCounter}` };
      }
    } else if (direction.kind === "intend") {
      const filtered = filterIntention(direction.text, { band: bandForRank(opts.rank()), principalRank: opts.rank() });
      if (!filtered.ok) {
        report({ kind: "refused", at: t, beat: p.beat, of, direction: p.raw, reason: `the constitution's filter: ${filtered.reason}` });
        log(`principal beat ${p.beat}/${of} refused by the filter (${filtered.reason})`);
        return;
      }
      direction = { kind: "intend", text: filtered.text };
    }
    let result: Awaited<ReturnType<DirectorChannel["direct"]>> | null;
    try {
      result = await channel.direct(direction);
    } catch (error) {
      result = { ok: false, error: `the town could not be reached (${error instanceof Error ? error.message : String(error)})` };
    }
    if (!result.ok) {
      report({ kind: "refused", at: t, beat: p.beat, of, direction: p.raw, reason: `the town: ${result.error}` });
      log(`principal beat ${p.beat}/${of} refused by the town (${refusalCategory(result.error)}); kind ${direction.kind}`);
      return;
    }
    report({ kind: "performed", at: t, beat: p.beat, of, direction, condition, ...(altered ? { altered } : {}) });
    log(`principal beat ${p.beat}/${of} performed (kind ${direction.kind}; condition: ${condition}${altered ? `; altered by the filter` : ""})`);
    if (direction.kind === "speak") {
      keep({ who: "her", by: "principal", text: direction.text, at: t });
      await setComposing(false);
    }
  };

  /** The visit opened under a held sequence: its clock starts now. */
  const unhold = (seq: Sequence, state: ChannelState, reason: string) => {
    const t = now();
    const shift = t - seq.startedAt;
    for (const b of seq.beats) b.dueAt += shift;
    seq.heldUntil = null;
    seq.startedAt = t;
    seq.startSeq = state.latestSeq;
    seq.startZone = state.telemetry?.gaiusZone ?? null;
    seq.beganAt = beganAt;
    report({ kind: "unheld", at: t, of: seq.of, reason });
    log(`principal sequence (${seq.of} beat${seq.of === 1 ? "" : "s"}) released from hold: ${reason}`);
  };

  const pump = async (): Promise<void> => {
    if (pumping) return;
    pumping = true;
    try {
      while (sequence) {
        if (!liveNow()) return;
        const seq = sequence;
        if (seq.heldUntil !== null) {
          // Held for a visit that has not opened yet: a look a second at most.
          const t0 = now();
          if (t0 < heldLookAt + 1000) return;
          heldLookAt = t0;
          const held = await quiet("readState", () => channel.readState());
          if (sequence !== seq) continue;
          if (held?.active) {
            followVisit(held);
            unhold(seq, held, "the visit opened");
            continue;
          }
          if (t0 >= seq.heldUntil) dropSequence(`no visit opened within ${Math.round(PRINCIPAL_HOLD_MS / 1000)} s`);
          return;
        }
        const next = seq.beats[0];
        if (!next || now() < next.dueAt) return;
        // A fresh look at the slate before each beat: has he replied, has he moved on?
        const state = await quiet("readState", () => channel.readState());
        if (sequence !== seq) continue; // superseded meanwhile
        if (state) followVisit(state);
        if (sequence !== seq) continue;
        if (!state || !state.active) {
          dropSequence("the visit is not open");
          return;
        }
        const zone = state.telemetry?.gaiusZone ?? null;
        if (seq.dropOnReply && state.latestSeq > seq.startSeq) {
          dropSequence(`he replied (line ${state.latestSeq})`);
          return;
        }
        if (seq.dropOnScene && sceneChangedMaterially(seq.startZone, zone)) {
          dropSequence(`his scene changed from ${seq.startZone} to ${zone}`);
          return;
        }
        seq.beats.shift();
        if (next.when.noReply && state.latestSeq > seq.startSeq) {
          report({ kind: "dropped", at: now(), beat: next.beat, of: seq.of, reason: `condition not met: he replied (line ${state.latestSeq})` });
          log(`principal beat ${next.beat}/${seq.of} skipped: no-reply condition not met`);
        } else if (next.when.scene && zone !== next.when.scene) {
          report({ kind: "dropped", at: now(), beat: next.beat, of: seq.of, reason: `condition not met: his scene is ${zone ?? "unknown"}, not ${next.when.scene}` });
          log(`principal beat ${next.beat}/${seq.of} skipped: scene condition not met (${zone})`);
        } else {
          await deliver(next, seq.of, describe(next.when));
        }
        if (sequence === seq && seq.beats.length === 0) {
          sequence = null;
          log(`principal sequence finished (${seq.of} beat${seq.of === 1 ? "" : "s"}); she is silent until her next call`);
        }
      }
    } finally {
      pumping = false;
    }
  };

  const slate = async (includeFrame: boolean): Promise<PrincipalSlate> => {
    const t = now();
    const live = liveNow();
    const s = lastState;
    const out: PrincipalSlate = {
      now: t,
      claim: { live, since: live ? claimSince : null, lastCallAt, expiresAt: live && lastCallAt !== null ? lastCallAt + claimMs : null, lapseMs: claimMs },
      visit: { active: !!s?.active, beganAt: s?.active ? s.beganAt : null, ...(s?.active && s.background ? { background: true } : {}) },
      scene: s?.telemetry ?? null,
      intention: s?.intention ?? null,
      composing,
      latestSeq,
      waiting: transcript.filter((l) => l.who === "him" && (l.seq ?? 0) > answeredSeq),
      transcript: [...transcript],
      sequence: sequence ? { remaining: sequence.beats.length, nextAt: sequence.heldUntil === null ? (sequence.beats[0]?.dueAt ?? null) : null, heldUntil: sequence.heldUntil } : null,
      reports,
    };
    reports = [];
    shownSeq = latestSeq;
    if (includeFrame) out.frame = s?.active ? await quiet("readFrame", () => channel.readFrame()) : null;
    return out;
  };

  const inner: Omit<PrincipalDesk, "subscribe"> = {
    async wake(raw) {
      const t = now();
      const parsed = parsePrincipalCall(raw);
      // Event type and counts only (Task 64): never the body, a direction's text or an unknown field.
      log(`principal call ${new Date(t).toISOString()}: ${parsed.ok ? `${parsed.call.beats?.length ?? 0} beat(s)${parsed.call.attend === false ? ", release" : ""}` : "refused: not a valid call"}`);
      if (!parsed.ok) return parsed;
      const call = parsed.call;
      const wasLive = liveNow();
      if (call.attend === false) {
        const state = await quiet("readState", () => channel.readState());
        if (state) followVisit(state);
        await readMail();
        await release("released");
        lastCallAt = t;
        return { ok: true, slate: await slate(!!call.frame) };
      }
      lastCallAt = t;
      if (!wasLive) {
        claimSince = t;
        report({ kind: "claim", at: t, event: "claimed" });
        log("principal claims the visit; the resident only relays");
      }
      const state = await quiet("readState", () => channel.readState());
      if (state) followVisit(state);
      await readMail();
      const items: PrincipalBeat[] | null = call.beats ?? (call.direction !== undefined ? [{ direction: call.direction }] : null);
      if (items) {
        if (sequence) dropSequence("superseded by her next call");
        let due = t;
        const beats: Pending[] = items.map((b, i) => {
          due += (b.delayS ?? 0) * 1000;
          const v = validateDirection(b.direction);
          const direction = v.ok && v.direction.kind === "speak" ? { kind: "speak" as const, text: v.direction.text } : v.ok ? v.direction : null;
          return { beat: i + 1, dueAt: due, direction, raw: b.direction, invalid: v.ok ? null : v.error, when: b.when ?? {} };
        });
        const open = !!state?.active;
        sequence = {
          heldUntil: open ? null : t + PRINCIPAL_HOLD_MS,
          startedAt: t,
          startSeq: latestSeq,
          startZone: state?.telemetry?.gaiusZone ?? null,
          beganAt,
          of: beats.length,
          beats,
          dropOnReply: call.drop?.onReply ?? true,
          dropOnScene: call.drop?.onSceneChange ?? true,
        };
        if (beats.some((b) => b.direction?.kind === "speak")) answeredSeq = Math.max(answeredSeq, Math.min(call.seen ?? shownSeq, latestSeq));
        if (!open) {
          report({ kind: "held", at: t, of: beats.length, until: t + PRINCIPAL_HOLD_MS, reason: "held until the visit opens" });
          log(`principal sequence (${beats.length} beat${beats.length === 1 ? "" : "s"}) held: no visit is open; held up to ${Math.round(PRINCIPAL_HOLD_MS / 1000)} s`);
          heldLookAt = t;
        }
        await pump();
      }
      return { ok: true, slate: await slate(!!call.frame) };
    },
    marker() {
      const live = liveNow();
      const waiting = latestSeq > answeredSeq && !!lastState?.active;
      return { waiting, seq: waiting ? latestSeq : null, at: waiting ? latestAt : null, composing, claimLive: live };
    },
    live: liveNow,
    async observe(state) {
      followVisit(state);
      if (!liveNow()) return;
      if (sequence && sequence.heldUntil !== null && state.active) unhold(sequence, state, "the visit opened");
      await readMail();
      if (state.active && state.latestSeq > ackedSeq) {
        ackedSeq = state.latestSeq;
        // Presence only: eye contact is instant, words wait for their author.
        const tel = state.telemetry;
        const seatedNear = !!tel && tel.museSeated && tel.distanceToGaius <= ACK_APART_M;
        let staging = "composing";
        if (!seatedNear) {
          const r = await quiet("acknowledge", () => channel.direct({ kind: "goto", anchor: "gaius" }));
          staging = r?.ok
            ? `${tel && tel.distanceToGaius > ACK_APART_M ? `walks to him (${tel.distanceToGaius.toFixed(1)} m)` : "turns to him"}, composing`
            : `composing (the town declined the turn: ${r && !r.ok ? r.error : "unreachable"})`;
        } else staging = "stays seated beside him, composing";
        await setComposing(true);
        report({ kind: "acknowledged", at: now(), seq: state.latestSeq, staging });
        log(`principal acknowledgment: line ${state.latestSeq} landed; she ${staging}`);
      }
      if (sequence && state.active) {
        // Between beats too: his reply, or his walking off, ends her sequence now.
        const zone = state.telemetry?.gaiusZone ?? null;
        if (sequence.dropOnReply && state.latestSeq > sequence.startSeq) dropSequence(`he replied (line ${state.latestSeq})`);
        else if (sequence.dropOnScene && sceneChangedMaterially(sequence.startZone, zone)) dropSequence(`his scene changed from ${sequence.startZone} to ${zone}`);
      }
      if (sequence) await pump();
    },
    pump,
    keepClaim() {
      const t = now();
      if (!liveNow()) {
        claimSince = t;
        report({ kind: "claim", at: t, event: "claimed" });
        log("principal claims the visit (watcher); the resident only relays");
      }
      lastCallAt = t;
    },
    noteResidentLine(text) {
      keep({ who: "her", by: "resident", text, at: now() });
    },
  };

  /** Task 66: tell every subscriber the marker, when it has changed since the last telling. */
  const notify = () => {
    if (listeners.size === 0) return;
    const m = inner.marker();
    const key = JSON.stringify(m);
    if (key === lastSent) return;
    lastSent = key;
    for (const l of [...listeners]) {
      try {
        l(m);
      } catch {
        /* a dead subscriber must not hurt the desk */
      }
    }
  };
  /** Every call that can turn the marker over tells the subscribers afterwards. */
  const then = <A extends unknown[], R>(fn: (...a: A) => R) => (...a: A): R => {
    const out = fn(...a);
    if (out instanceof Promise) return out.finally(notify) as R;
    notify();
    return out;
  };
  return {
    ...inner,
    wake: then(inner.wake),
    observe: then(inner.observe),
    pump: then(inner.pump),
    keepClaim: then(inner.keepClaim),
    subscribe(listener) {
      listeners.add(listener);
      try {
        listener(inner.marker());
      } catch {
        /* see notify */
      }
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

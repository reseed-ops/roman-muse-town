/**
 * The fake channel (Task 6): an in-memory director channel that plays
 * the town for tests. It holds a slate the test fills (open a visit,
 * drop mail, lay a frame) and records every direction the director
 * leaves; it can also play dead.
 */
import type { DirectorPack, QueuedDirection, VisitDirection, VisitFrame, VisitMail, VisitStateView, VisitTelemetry } from "../../shared/visitProtocol.js";
import type { ChannelState, DirectResult, DirectorChannel } from "./channel.js";

export type FakeChannel = DirectorChannel & {
  open(now: number, telemetry?: VisitTelemetry | null): void;
  close(): void;
  mail(text: string, now: number): VisitMail;
  frame(dataUrl: string, now: number): VisitFrame;
  /** Every direction ever accepted, oldest first. */
  directions: QueuedDirection[];
  composing: boolean;
  composingLog: boolean[];
  /** Calls refused with an error while true. */
  dead: boolean;
  calls: string[];
  pack: DirectorPack | null;
};

export function createFakeChannel(): FakeChannel {
  let state: VisitStateView = closed();
  let inbox: VisitMail[] = [];
  let frames: VisitFrame[] = [];
  let nextSeq = 1;
  let nextFrameId = 1;
  let nextDirectionId = 1;
  const guard = (name: string) => {
    fake.calls.push(name);
    if (fake.dead) throw new Error(`dead channel: ${name}`);
  };
  const fake: FakeChannel = {
    directions: [],
    composing: false,
    composingLog: [],
    dead: false,
    calls: [],
    pack: null,
    open(now, telemetry = null) {
      state = { ...closed(), active: true, beganAt: now, heartbeatAt: now, telemetry };
      inbox = [];
      frames = [];
      nextSeq = 1;
      nextFrameId = 1;
    },
    close() {
      state = closed();
      inbox = [];
      frames = [];
      fake.composing = false;
    },
    mail(text, now) {
      const m = { seq: nextSeq++, text, at: now };
      inbox = [...inbox, m].slice(-20);
      state = { ...state, inboxCount: inbox.length, latestSeq: m.seq, heartbeatAt: now };
      return m;
    },
    frame(dataUrl, now) {
      const f: VisitFrame = { id: nextFrameId++, at: now, width: 720, height: 405, bytes: dataUrl.length, dataUrl };
      frames = [...frames, f].slice(-2);
      state = { ...state, frames: frames.map(({ dataUrl: _d, ...meta }) => meta) };
      return f;
    },
    async readState(): Promise<ChannelState> {
      guard("readState");
      return { ...state, composing: fake.composing, queueLength: 0 };
    },
    async readInbox(since) {
      guard("readInbox");
      return inbox.filter((m) => m.seq > since);
    },
    async readFrame(id) {
      guard("readFrame");
      return id === undefined ? (frames[frames.length - 1] ?? null) : (frames.find((f) => f.id === id) ?? null);
    },
    async direct(direction: VisitDirection): Promise<DirectResult> {
      guard("direct");
      if (!state.active) return { ok: false, error: "no visit is open" };
      const id = nextDirectionId++;
      fake.directions.push({ id, at: state.heartbeatAt ?? 0, direction });
      if (direction.kind === "look") {
        // The town answers a look promptly with a fresh frame.
        fake.frame(`data:image/jpeg;base64,/9j/look${id}`, (state.heartbeatAt ?? 0) + 1);
      }
      return { ok: true, id };
    },
    async setComposing(on) {
      guard("setComposing");
      fake.composing = on;
      fake.composingLog.push(on);
    },
    async readPack() {
      guard("readPack");
      return fake.pack;
    },
  };
  return fake;
}

function closed(): VisitStateView {
  return {
    active: false,
    beganAt: null,
    heartbeatAt: null,
    intention: null,
    composing: false,
    telemetry: null,
    events: [],
    inboxCount: 0,
    latestSeq: 0,
    frames: [],
    queueLength: 0,
    enactedThrough: 0,
  };
}

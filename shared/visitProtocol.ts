/**
 * Muse Visits, the protocol (Task 4 and Task 6, Nov 2026).
 *
 * The one vocabulary shared by the town client, the local dev harness
 * (harness/visitHarness.ts) that stands in for the private slate on
 * this line, and the Live Bridge director (bridge/). Everything here is
 * pure data and validation: no DOM, no network, no town geometry, so
 * every rule is pinned by a test and every side agrees byte for byte.
 *
 * The constitution, in shapes: a direction moves her body, borrows her
 * bubble, or asks for a look. There is no direction that writes to
 * facts, letters, the notebook, the bond, the purse, or the digest, and
 * nothing in a visit is ever persisted into the save. A visit fails
 * only into ordinariness: when the director goes quiet the heartbeat
 * lapses and she folds back into her own life.
 */

/** Named places a goto may use; the client resolves each to a spot. */
export const VISIT_ANCHOR_NAMES = [
  "tree",
  "lakeshore",
  "forum",
  "stories",
  "terrace",
  "market",
  "boat",
  "bench",
  "bath",
  "gate",
  "sounds",
  "piscina",
  "gaius",
] as const;
export type VisitAnchorName = (typeof VISIT_ANCHOR_NAMES)[number];

export const VISIT_EMOTES = ["wave", "bow", "dance"] as const;
export type VisitEmote = (typeof VISIT_EMOTES)[number];

export const PAD_VERB_BUTTONS = ["a", "b", "x"] as const;
export type PadVerbButton = (typeof PAD_VERB_BUTTONS)[number];

/** The speak cap: Aelia's own bubble rule is one or two short
 *  sentences, at most 40 words; the character cap is the hard rail. */
export const SPEAK_MAX_CHARS = 280;
export const SPEAK_MAX_WORDS = 40;
export const INTENTION_MAX_CHARS = 120;
/** A pad verb holds its vector at most this long, then decays to rest. */
export const PAD_VERB_MAX_MS = 5000;
/** Ground points must stay inside this radius of the town's centre
 *  (the scene's own rim), or inside the forest; the client checks the
 *  forest, the protocol checks the rim and sanity. */
export const TOWN_RIM_RADIUS = 52;
export const GROUND_POINT_SANITY = 80;

/** The visit inbox keeps the most recent mail only. */
export const VISIT_INBOX_CAP = 20;
/** Latest frames kept on the slate. */
export const VISIT_FRAME_KEEP = 2;
/** The capped ring of small world events. */
export const VISIT_EVENT_CAP = 24;
/** Frame shape: long edge cap, JPEG quality, cadence, decoded byte cap. */
export const FRAME_MAX_EDGE = 720;
export const FRAME_JPEG_QUALITY = 0.7;
export const FRAME_CADENCE_MS = 30_000;
export const FRAME_MAX_BYTES = 400_000;
/** A visit lapses when its heartbeat is this old (a generous stretch). */
export const VISIT_LAPSE_MS = 20 * 60 * 1000;
/** The client's poll beat while a visit is open. */
export const VISIT_POLL_MS = 4000;
/** Consent, worn openly in the panel while a visit is open. Exact. */
export const SIGHT_LINE = "Muse can see your view while visiting.";
/** The visiting marker in the panel header. */
export const VISITING_MARKER = "Muse is visiting";
/** Her star while a visit is open (Tuan's colour, Nov 2 2026). */
export const VISIT_STAR_COLOR = 0x8b5cf6;
export const VISIT_STAR_EMISSIVE = 0x5b21b6;

export type VisitDirection =
  | { kind: "goto"; anchor: VisitAnchorName }
  | { kind: "goto"; x: number; z: number }
  | { kind: "sit" }
  | { kind: "stand" }
  | { kind: "seat" }
  | { kind: "stepout" }
  | { kind: "emote"; emote: VisitEmote }
  | {
      kind: "speak";
      text: string;
      /** A growing line: the same lineId, text so far; the final speak
       *  of a line carries partial false (or omitted). */
      partial?: boolean;
      lineId?: string;
    }
  | { kind: "intend"; text: string }
  | { kind: "look" }
  | { kind: "pad"; dx: number; dz: number; buttons: PadVerbButton[]; ms: number };

export type VisitDirectionKind = VisitDirection["kind"];
export const VISIT_DIRECTION_KINDS: readonly VisitDirectionKind[] = [
  "goto", "sit", "stand", "seat", "stepout", "emote", "speak", "intend", "look", "pad",
];

/** A direction once it is on the queue: numbered and stamped. */
export type QueuedDirection = { id: number; at: number; direction: VisitDirection };

export type VisitMail = { seq: number; text: string; at: number };

export type VisitFrameMeta = { id: number; at: number; width: number; height: number; bytes: number };
export type VisitFrame = VisitFrameMeta & { dataUrl: string };

export type DayPhase = "night" | "dawn" | "day" | "dusk";

/** What the slate carries of the world, copied nowhere else. */
export type VisitTelemetry = {
  /** Her nearest anchor, or "roaming". */
  museZone: string;
  /** His nearest anchor, or "roaming", or "away" when he is not on foot. */
  gaiusZone: string;
  museSeated: boolean;
  gaiusSeated: boolean;
  gaiusWalking: boolean;
  dayPhase: DayPhase;
  museX: number;
  museZ: number;
  gaiusX: number;
  gaiusZ: number;
  /** Radians, the town's convention (atan2(dx, dz)). */
  museHeading: number;
  gaiusHeading: number;
  /** From her to him. */
  bearingToGaius: number;
  distanceToGaius: number;
  /** Who holds pad2 right now. */
  pad2Source: "none" | "human" | "director";
};

export type VisitEvent = { at: number; text: string };

/** What a director reads: frame metadata only, never bytes. */
export type VisitStateView = {
  active: boolean;
  beganAt: number | null;
  heartbeatAt: number | null;
  intention: string | null;
  composing: boolean;
  telemetry: VisitTelemetry | null;
  events: VisitEvent[];
  inboxCount: number;
  latestSeq: number;
  frames: VisitFrameMeta[];
  queueLength: number;
  /** The direction ids enacted so far, for a director's bookkeeping. */
  enactedThrough: number;
};

export type DirectionValidation =
  | { ok: true; direction: VisitDirection }
  | { ok: false; error: string };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isFiniteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export const countWords = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;

/** Validate a raw direction from any source. Strict and total: a bad
 *  shape is an error string, never a thrown exception, and nothing
 *  unknown passes through to the client. */
export function validateDirection(raw: unknown): DirectionValidation {
  if (!isRecord(raw)) return { ok: false, error: "a direction is an object" };
  const kind = raw.kind;
  if (typeof kind !== "string" || !(VISIT_DIRECTION_KINDS as readonly string[]).includes(kind)) {
    return { ok: false, error: `unknown direction kind: ${String(kind)}` };
  }
  switch (kind as VisitDirectionKind) {
    case "goto": {
      if (typeof raw.anchor === "string") {
        if (!(VISIT_ANCHOR_NAMES as readonly string[]).includes(raw.anchor)) {
          return { ok: false, error: `unknown anchor: ${raw.anchor}` };
        }
        return { ok: true, direction: { kind: "goto", anchor: raw.anchor as VisitAnchorName } };
      }
      if (isFiniteNumber(raw.x) && isFiniteNumber(raw.z)) {
        if (Math.abs(raw.x) > GROUND_POINT_SANITY || Math.abs(raw.z) > GROUND_POINT_SANITY) {
          return { ok: false, error: "ground point out of the world" };
        }
        return { ok: true, direction: { kind: "goto", x: raw.x, z: raw.z } };
      }
      return { ok: false, error: "goto needs an anchor name or a ground point x, z" };
    }
    case "sit":
    case "stand":
    case "seat":
    case "stepout":
    case "look":
      return { ok: true, direction: { kind: kind as "sit" | "stand" | "seat" | "stepout" | "look" } };
    case "emote": {
      if (typeof raw.emote !== "string" || !(VISIT_EMOTES as readonly string[]).includes(raw.emote)) {
        return { ok: false, error: `unknown emote: ${String(raw.emote)}` };
      }
      return { ok: true, direction: { kind: "emote", emote: raw.emote as VisitEmote } };
    }
    case "speak": {
      if (typeof raw.text !== "string") return { ok: false, error: "speak needs text" };
      const text = raw.text.trim();
      if (!text) return { ok: false, error: "speak text is empty" };
      if (text.length > SPEAK_MAX_CHARS) return { ok: false, error: `speak text over ${SPEAK_MAX_CHARS} characters` };
      const partial = raw.partial === true;
      const lineId = typeof raw.lineId === "string" && raw.lineId.length > 0 && raw.lineId.length <= 64 ? raw.lineId : undefined;
      if (partial && !lineId) return { ok: false, error: "a partial speak needs a lineId" };
      const direction: VisitDirection = { kind: "speak", text };
      if (partial) direction.partial = true;
      if (lineId) direction.lineId = lineId;
      return { ok: true, direction };
    }
    case "intend": {
      if (typeof raw.text !== "string") return { ok: false, error: "intend needs text" };
      const text = raw.text.trim();
      if (!text) return { ok: false, error: "intend text is empty" };
      if (text.length > INTENTION_MAX_CHARS) return { ok: false, error: `intention over ${INTENTION_MAX_CHARS} characters` };
      return { ok: true, direction: { kind: "intend", text } };
    }
    case "pad": {
      if (!isFiniteNumber(raw.dx) || !isFiniteNumber(raw.dz)) return { ok: false, error: "pad needs dx and dz" };
      if (Math.abs(raw.dx) > 1 || Math.abs(raw.dz) > 1) return { ok: false, error: "pad dx and dz are -1..1" };
      if (!isFiniteNumber(raw.ms) || raw.ms < 1 || raw.ms > PAD_VERB_MAX_MS) {
        return { ok: false, error: `pad ms is 1..${PAD_VERB_MAX_MS}` };
      }
      const buttons: PadVerbButton[] = [];
      if (raw.buttons !== undefined) {
        if (!Array.isArray(raw.buttons)) return { ok: false, error: "pad buttons is a list" };
        for (const b of raw.buttons) {
          if (typeof b !== "string" || !(PAD_VERB_BUTTONS as readonly string[]).includes(b)) {
            return { ok: false, error: `unknown pad button: ${String(b)}` };
          }
          if (!buttons.includes(b as PadVerbButton)) buttons.push(b as PadVerbButton);
        }
      }
      return { ok: true, direction: { kind: "pad", dx: raw.dx, dz: raw.dz, buttons, ms: Math.round(raw.ms) } };
    }
  }
}

/** A ground point the town can walk: inside the rim. (The client adds
 *  the forest ellipse, which lies partly outside the rim.) */
export const withinTownRim = (x: number, z: number): boolean => Math.hypot(x, z) <= TOWN_RIM_RADIUS;

// --- The harness wire shapes -------------------------------------------
// The client pushes its whole slate view each beat and pulls what the
// director left; the director reads and enqueues through its own
// routes. One shape each way, so a transport swap (Adapter B on the
// private line) changes the carrier and nothing else.

/** The client's beat: everything the director may read, plus any new
 *  frames (bytes travel only here, and only the new ones). */
export type ClientSyncRequest = {
  state: VisitStateView;
  inbox: VisitMail[];
  newFrames: VisitFrame[];
  /** Ids the client has enacted, so the harness drops them. */
  enactedThrough: number;
};

export type ClientSyncResponse = {
  /** Pending directions, oldest first; the client enacts and reports. */
  directions: QueuedDirection[];
  composing: boolean;
  /** When the director last read or wrote; null if never. */
  directorSeenAt: number | null;
  /** The director asked the client to begin or end a visit. */
  begin: boolean;
  end: boolean;
};

export type DirectorPack = { text: string; updatedAt: number | null };

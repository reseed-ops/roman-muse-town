// The director door (Task 8): the locked visit actions a director calls
// on the hosted town to read one visitor's slate and leave directions.
//
// Web-only, and slate-only by construction: these actions never receive
// a database, only the visitor's slate face (shared/slateFace.ts), so
// they cannot reach facts, letters, bond, purse or digest; and nothing
// here persists, a face lives in memory and dies with the visit. The
// web server (web/src/server.ts) admits a call only with the service's
// DIRECTOR_TOKEN and the visitor's own token, and refuses quietly (as an
// unknown action) without them. The artifact and Android lines never
// register these: actions.ts does not include them.
//
// The visitor's own client feeds the face through the two bridge routes
// (POST /bridge/snapshot, GET /bridge/directions) with its visitor token,
// exactly as it feeds the Live Bridge's face (Task 7).

import { z } from "zod";
import type { SlateFace } from "../../shared/slateFace";
import { DOOR_ACTIONS, type DoorAction } from "../../shared/visitProtocol";

export interface DoorDefinition<Req extends z.ZodType, Res extends z.ZodType> {
  description: string;
  request: Req;
  response: Res;
  handler(slate: SlateFace, args: z.output<Req>): Promise<z.output<Res>>;
}

const define = <Req extends z.ZodType, Res extends z.ZodType>(definition: DoorDefinition<Req, Res>) => definition;

const frameMeta = z.object({ id: z.number(), at: z.number(), width: z.number(), height: z.number(), bytes: z.number() });
const stateView = z.object({
  active: z.boolean(),
  beganAt: z.number().nullable(),
  heartbeatAt: z.number().nullable(),
  intention: z.string().nullable(),
  composing: z.boolean(),
  telemetry: z.record(z.string(), z.unknown()).nullable(),
  events: z.array(z.object({ at: z.number(), text: z.string() })),
  inboxCount: z.number(),
  latestSeq: z.number(),
  frames: z.array(frameMeta),
  queueLength: z.number(),
  enactedThrough: z.number(),
  stale: z.boolean().optional(),
  background: z.boolean().optional(),
});
const mail = z.object({ seq: z.number(), text: z.string(), at: z.number() });
const directResult = z.union([z.object({ ok: z.literal(true), id: z.number() }), z.object({ ok: z.literal(false), error: z.string() })]);

export const visitActions = {
  visitstate: define({
    description: "The visitor's slate as a director reads it: the state view and the inbox mail since a seq.",
    request: z.object({ since: z.number().int().min(0).default(0) }),
    response: z.object({ state: stateView, mail: z.array(mail) }),
    async handler(slate, args) {
      const state = await slate.channel.readState();
      const inbox = await slate.channel.readInbox(args.since);
      return { state, mail: inbox };
    },
  }),
  visitdirect: define({
    description: "Leave one direction on the visitor's slate; validated by the seam validator, refused with a reason otherwise.",
    request: z.object({ direction: z.unknown() }),
    response: directResult,
    async handler(slate, args) {
      // The face validates the shape; an unknown shape is refused, never thrown.
      return slate.channel.direct(args.direction as never);
    },
  }),
  visitcomposing: define({
    description: "Set the director's composing flag, which the town shows as her writing line.",
    request: z.object({ on: z.boolean() }),
    response: z.object({ ok: z.literal(true) }),
    async handler(slate, args) {
      await slate.channel.setComposing(args.on);
      return { ok: true as const };
    },
  }),
  visitframeget: define({
    description: "One frame the visitor's client offered: by id, or the latest. Null when none is held.",
    request: z.object({ id: z.number().int().min(1).optional() }),
    response: z.object({ frame: frameMeta.extend({ dataUrl: z.string() }).nullable() }),
    async handler(slate, args) {
      return { frame: await slate.channel.readFrame(args.id) };
    },
  }),
  beginvisit: define({
    description: "Ask the visitor's town to open a visit; the client hears it on its next glance and opens one.",
    request: z.object({}),
    response: z.object({ ok: z.literal(true), active: z.boolean() }),
    async handler(slate) {
      const state = await slate.channel.readState();
      if (!state.active) slate.requestBegin();
      return { ok: true as const, active: state.active };
    },
  }),
  endvisit: define({
    description: "Ask the visitor's town to end the visit; the client folds it on its next pull.",
    request: z.object({}),
    response: z.object({ ok: z.literal(true) }),
    async handler(slate) {
      slate.requestEnd();
      return { ok: true as const };
    },
  }),
} satisfies Record<DoorAction, DoorDefinition<z.ZodType, z.ZodType>>;

export type VisitActions = typeof visitActions;

/** Every door action is named in the protocol's list, and nothing else is. */
export const isDoorAction = (name: string): name is DoorAction => (DOOR_ACTIONS as readonly string[]).includes(name);

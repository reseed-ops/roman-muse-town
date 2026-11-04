/**
 * Adapter B (Task 6): the director channel over the private town's
 * slate. The private slate is reached today only through chat Muse's
 * action channel; Gate 0 (the channel proof) is Muse's to run on the
 * private side, and the proven transport and exact shapes will be
 * appended to CLAUDE-TASKS.md. Until that note lands this file carries
 * the INTERFACE only: a SlateTransport the proof will implement, and
 * the mapping from the director channel onto named slate actions whose
 * names are placeholders to be confirmed, not guesses to be trusted.
 * Nothing here is wired by default; the unproven transport refuses
 * every call with a plain message.
 */
import type { DirectorPack, VisitDirection, VisitFrame, VisitMail } from "../../shared/visitProtocol.js";
import type { ChannelState, DirectResult, DirectorChannel } from "./channel.js";

/** One call on the private action surface: an action name and its
 *  arguments, a JSON result. The proof decides how this is carried
 *  (the artifact's own HTTP action surface with the owner's session, a
 *  headless browser session, or a sanctioned director endpoint). */
export interface SlateTransport {
  call(action: string, args: Record<string, unknown>): Promise<unknown>;
}

/** Action names, to be replaced by the proven ones. Kept in one place so
 *  the swap is a single edit. */
export const SLATE_ACTIONS = {
  state: "visitstate",
  inbox: "visitinbox",
  frame: "visitframe",
  direct: "visitdirect",
  composing: "visitcomposing",
  pack: "visitpack",
} as const;

export function createSlateAdapter(transport: SlateTransport, actions: typeof SLATE_ACTIONS = SLATE_ACTIONS): DirectorChannel {
  return {
    readState: async () => (await transport.call(actions.state, {})) as ChannelState,
    readInbox: async (since) => (await transport.call(actions.inbox, { since })) as VisitMail[],
    readFrame: async (id) => ((await transport.call(actions.frame, id === undefined ? {} : { id })) as VisitFrame | null) ?? null,
    direct: async (direction: VisitDirection) => (await transport.call(actions.direct, { direction })) as DirectResult,
    setComposing: async (on) => {
      await transport.call(actions.composing, { on });
    },
    readPack: async () => ((await transport.call(actions.pack, {})) as DirectorPack | null) ?? null,
  };
}

/** The transport before Gate 0: every call refuses, plainly. */
export function unprovenTransport(): SlateTransport {
  return {
    call: async (action) => {
      throw new Error(`Adapter B transport is not proven yet (Gate 0): refused ${action}. See CLAUDE-TASKS.md, Task 6.`);
    },
  };
}

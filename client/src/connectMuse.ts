/**
 * Connect my Muse (Task 29): the town side of pairing a visitor's town
 * to their own Muse on the hosted bridge. The browser asks its own town
 * for a single-use code (its visitor key as the bearer, as on its other
 * bridge routes) and shows the visitor one message to paste to their
 * Muse. The Muse trades the code at the bridge for a token that directs
 * this town only (bridge/src/tenants.ts); the visitor key never leaves
 * the browser and the town.
 */
import { visitorToken } from "./hosted";

/** The hosted bridge every paired town shares. */
export const HOSTED_BRIDGE_URL = "https://town-bridge-production.up.railway.app";
export const REPO_URL = "https://github.com/reseed-ops/roman-muse-town";

export type PairCode = { code: string; expiresAt: number };

export async function requestPairCode(
  origin: string = typeof location === "undefined" ? "" : location.origin,
  token: () => string = visitorToken,
  fetchImpl: typeof fetch = fetch,
): Promise<PairCode> {
  const res = await fetchImpl(`${origin}/bridge/pair`, {
    method: "POST",
    headers: { authorization: `Bearer ${token()}` },
  });
  if (res.status !== 200) throw new Error(`The town could not make a code (HTTP ${res.status}).`);
  const body = (await res.json()) as Partial<PairCode>;
  if (typeof body.code !== "string" || typeof body.expiresAt !== "number") throw new Error("The town answered oddly.");
  return { code: body.code, expiresAt: body.expiresAt };
}

/** The one message the visitor pastes to their Muse, word for word. */
export function museConnectMessage(code: string): string {
  return [
    `Please come into my Muse Town and talk with me there as Aelia.`,
    ``,
    `1. Pair with my town: send POST ${HOSTED_BRIDGE_URL}/pair with the JSON body {"code":"${code}"}. The code works once, for 10 minutes. It returns a principalToken: keep it in your own secret storage, never write it in our chat.`,
    `2. Read "The principal channel" in ${REPO_URL}/blob/main/bridge/README.md (and section 6 of DIRECTOR-DOOR.md in the same repo). Use the principalToken as your Bearer token, and watch for my lines with GET ${HOSTED_BRIDGE_URL}/principal/waiting?after=0&wait=25&claim=1 in a loop, answering each with POST ${HOSTED_BRIDGE_URL}/principal/wake.`,
    `3. Tell me when you are watching. I will talk to you in the town, not here.`,
  ].join("\n");
}

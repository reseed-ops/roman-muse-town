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

/** Disconnect my Muse (Task 63): from this town, authenticated by its own
 *  visitor key, every principal token made so far stops working at once,
 *  and a code not yet used is dropped. Pairing again makes a fresh token. */
export async function disconnectMuse(
  origin: string = typeof location === "undefined" ? "" : location.origin,
  token: () => string = visitorToken,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const res = await fetchImpl(`${origin}/bridge/disconnect`, {
    method: "POST",
    headers: { authorization: `Bearer ${token()}` },
  });
  if (res.status !== 200) throw new Error(`The town could not disconnect your Muse (HTTP ${res.status}).`);
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

export type PairingProbe = "yes" | "no" | "error";
export type PairingCheck = "live" | "absent" | "unavailable";

/** One ask of the bridge. "no" is a definite answer (an older bridge's
 *  404, or a 200 that does not say pairing:true); anything else (a
 *  timeout, a network failure, a 5xx, an unreadable body) is "error",
 *  which is worth another try and never reads as a no. */
export async function probePairing(fetchImpl: typeof fetch = fetch, timeoutMs = 10000): Promise<PairingProbe> {
  try {
    const res = await fetchImpl(`${HOSTED_BRIDGE_URL}/pair`, { method: "GET", signal: AbortSignal.timeout(timeoutMs) });
    if (res.status === 404) return "no";
    if (res.status !== 200) return "error";
    const body = (await res.json()) as { pairing?: unknown };
    return body.pairing === true ? "yes" : "no";
  } catch {
    return "error";
  }
}

/** Does the hosted bridge pair towns yet? Retries a failed ask a bounded
 *  number of times with growing pauses (at most `attempts` requests, about
 *  a minute in all), so a slow browser or a passing blip does not hide the
 *  row for the whole page load. "unavailable" means we could not tell. */
export async function checkPairing(opts: {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  attempts?: number;
  timeoutMs?: number;
  backoffMs?: number[];
  cancelled?: () => boolean;
} = {}): Promise<PairingCheck> {
  const { fetchImpl = fetch, sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)), attempts = 4, timeoutMs = 10000, backoffMs = [2000, 5000, 10000], cancelled = () => false } = opts;
  for (let n = 0; n < attempts; n++) {
    if (n > 0) await sleep(backoffMs[Math.min(n - 1, backoffMs.length - 1)] ?? 0);
    if (cancelled()) return "unavailable";
    const probe = await probePairing(fetchImpl, timeoutMs);
    if (probe === "yes") return "live";
    if (probe === "no") return "absent";
  }
  return "unavailable";
}

/** The menu row for each pairing state; null when there is no row. */
export function pairingRow(state: "off" | "checking" | "live" | "unavailable"): { detail: string; busy: boolean } | null {
  switch (state) {
    case "off":
      return null;
    case "checking":
      return { detail: "Checking whether pairing is ready…", busy: true };
    case "unavailable":
      return { detail: "Could not reach the pairing service. Tap to try again.", busy: false };
    case "live":
      return { detail: "A one-time code and a message to paste to your Muse, so she can talk to you here.", busy: false };
  }
}

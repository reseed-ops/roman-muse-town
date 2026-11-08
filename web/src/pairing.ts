// Pairing codes (Task 29): how a visitor's town is linked to a Muse on
// the hosted bridge without either side seeing what it must not.
//
// The browser asks its own town for a code (POST /bridge/pair, with its
// visitor key as the bearer, the same as its other bridge routes). The
// visitor hands the code to their Muse; the Muse hands it to the bridge;
// the bridge, which holds the service's DIRECTOR_TOKEN, redeems it here
// (POST /director/pair-redeem) and receives the visitor key, which it
// seals inside a principal token scoped to that one town. The Muse never
// sees the visitor key or the director token; the browser never sees the
// director token; a code names exactly one town.
//
// Codes are single use, live 10 minutes, one live code per town (asking
// again replaces it), and are kept in memory only: a restart forgets
// unredeemed codes, and the visitor simply asks again. Guessing is
// bounded by 10 characters from a 30-letter alphabet (about 49 bits),
// by the bridge's per-caller limit on POST /pair (bridge/src/
// principalServer.ts), and, here, by a high global backstop: so many
// misses in a minute that only a guesser spread over many addresses
// could reach it, and then redeeming pauses for that minute.

import { randomInt } from "node:crypto";

export const PAIR_CODE_MS = 10 * 60 * 1000;
/** Misses within the window that lock redeeming for the window. */
export const PAIR_MISS_LIMIT = 600;
export const PAIR_MISS_WINDOW_MS = 60 * 1000;
/** No 0/O, 1/I/L or U: easy to read aloud and to type. */
const ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
const CODE_LEN = 10;

export type PairRedeem = { ok: true; visitorToken: string } | { ok: false; reason: "unknown" | "locked" };

export interface PairingDesk {
  mint(visitorToken: string): { code: string; expiresAt: number };
  redeem(code: unknown): PairRedeem;
  /** Live codes, for tests and the log. */
  size(): number;
}

/** Upper case, letters and digits only, as the desk stores a code. */
export function normalizePairCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const bare = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return bare.length === CODE_LEN ? bare : null;
}

export function formatPairCode(bare: string): string {
  return `${bare.slice(0, 5)}-${bare.slice(5)}`;
}

export function createPairingDesk(opts: { now?: () => number } = {}): PairingDesk {
  const now = opts.now ?? (() => Date.now());
  const codes = new Map<string, { visitorToken: string; expiresAt: number }>();
  const liveByTown = new Map<string, string>();
  let misses: number[] = [];
  const sweep = () => {
    const t = now();
    for (const [code, entry] of codes) {
      if (entry.expiresAt <= t) {
        codes.delete(code);
        if (liveByTown.get(entry.visitorToken) === code) liveByTown.delete(entry.visitorToken);
      }
    }
    misses = misses.filter((at) => t - at < PAIR_MISS_WINDOW_MS);
  };
  return {
    mint(visitorToken) {
      sweep();
      const old = liveByTown.get(visitorToken);
      if (old) codes.delete(old);
      let bare = "";
      do {
        bare = "";
        for (let i = 0; i < CODE_LEN; i++) bare += ALPHABET[randomInt(ALPHABET.length)];
      } while (codes.has(bare));
      const expiresAt = now() + PAIR_CODE_MS;
      codes.set(bare, { visitorToken, expiresAt });
      liveByTown.set(visitorToken, bare);
      return { code: formatPairCode(bare), expiresAt };
    },
    redeem(raw) {
      sweep();
      if (misses.length >= PAIR_MISS_LIMIT) return { ok: false, reason: "locked" };
      const bare = normalizePairCode(raw);
      const entry = bare ? codes.get(bare) : undefined;
      if (!bare || !entry) {
        misses.push(now());
        return { ok: false, reason: "unknown" };
      }
      codes.delete(bare);
      if (liveByTown.get(entry.visitorToken) === bare) liveByTown.delete(entry.visitorToken);
      return { ok: true, visitorToken: entry.visitorToken };
    },
    size() {
      sweep();
      return codes.size;
    },
  };
}

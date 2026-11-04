// Tokens at the door (Task 8). Two kinds, both compared in constant time
// over digests and neither ever logged:
//
//   - the visitor token: minted by the client on its first visit, held in
//     its localStorage, sent on every call. It names the town (through a
//     hash, storage.pg.ts) and is the only key to it.
//   - the director token: set in the service's environment, required on
//     the locked visit actions beside the visitor's own token.

import { createHash, timingSafeEqual } from "node:crypto";
import { VISITOR_TOKEN_HEADER } from "../../shared/visitProtocol";

/** What a visitor token looks like: the client mints a UUID, and any
 *  printable key of a sane length is accepted so nothing clever is ever
 *  parsed out of it. */
export const VISITOR_TOKEN_SHAPE = /^[A-Za-z0-9_-]{20,96}$/;

export function tokenMatches(presented: string | null | undefined, expected: string | null | undefined): boolean {
  if (!presented || !expected) return false;
  const a = createHash("sha256").update(presented).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export function bearerToken(header: string | null): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(\S+)\s*$/i.exec(header);
  return m ? m[1]! : null;
}

/** The visitor token on a request: the header on action calls, the
 *  bearer on the bridge routes (the client's bridge leg speaks bearer). */
export function readVisitorToken(req: Request): string | null {
  const direct = req.headers.get(VISITOR_TOKEN_HEADER)?.trim() || null;
  const token = direct ?? bearerToken(req.headers.get("authorization"));
  return token && VISITOR_TOKEN_SHAPE.test(token) ? token : null;
}

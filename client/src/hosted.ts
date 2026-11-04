/**
 * The hosted town (Task 8): what the client knows about being on the
 * web rather than in the artifact runtime or the Android build. One
 * meta tag, written by web/build.ts into index.html, is the whole
 * signal; nothing else in client/src branches on where it runs.
 *
 * The visitor token is minted here once and kept in localStorage. It is
 * the only key to this town: there is no account and no sign-up, and
 * losing it (clearing site data, another browser) loses the town, which
 * Settings says in one plain line beside the save download, the real
 * remedy.
 */
import { HOSTED_META_NAME } from "../../shared/visitProtocol";

export const VISITOR_TOKEN_STORAGE_KEY = "muse-town-visitor-token";

export function isHostedTown(doc: { querySelector(selector: string): unknown } | undefined = typeof document === "undefined" ? undefined : document): boolean {
  return !!doc?.querySelector(`meta[name="${HOSTED_META_NAME}"]`);
}

let minted: string | null = null;

/** The visitor's token: read, or minted once and stored. With no
 *  storage (private browsing refusing it) one is minted per page load,
 *  and that town lasts the session. */
export function visitorToken(storage: { getItem(key: string): string | null; setItem(key: string, value: string): void } | undefined = readStorage()): string {
  try {
    const stored = storage?.getItem(VISITOR_TOKEN_STORAGE_KEY)?.trim();
    if (stored && /^[A-Za-z0-9_-]{20,96}$/.test(stored)) return stored;
  } catch {
    /* fall through to minting */
  }
  minted ??= crypto.randomUUID();
  try {
    storage?.setItem(VISITOR_TOKEN_STORAGE_KEY, minted);
  } catch {
    /* session-only town */
  }
  return minted;
}

function readStorage(): Storage | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

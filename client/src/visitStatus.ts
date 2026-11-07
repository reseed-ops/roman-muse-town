/**
 * What the town says about an open visit (owner's fix list, Nov 7,
 * 2026): one plain status line for the menu and the in-town indicator,
 * naming what is actually unreachable, and the reason a visit closed.
 * Pure, so every wording is pinned by a test.
 */
export type VisitDirectorState = "none" | "live" | "unreachable" | "refused";

/** Consecutive failed bridge beats before the town says "unreachable":
 *  one slow beat on a phone network is not an outage. */
export const UNREACHABLE_AFTER_FAILS = 3;
/** The writing line clears itself if nothing refreshes it this long. */
export const COMPOSING_STALE_MS = 90_000;
/** After her final line lands, a stale "composing" from the next pull
 *  is ignored this long, so the writing line does not flicker back. */
export const COMPOSING_SETTLE_MS = 4_000;
/** The warning stretch before an idle visit lapses. */
export const LAPSE_WARN_MS = 3 * 60 * 1000;

export type VisitRoute = { kind: "door"; host: string } | { kind: "bridge"; host: string } | { kind: "harness"; host: string } | { kind: "none" };

export function hostOf(url: string): string {
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
}

/** Where this town reports during a visit, named for a person. */
export function routeName(route: VisitRoute): string {
  switch (route.kind) {
    case "door":
      return `the town's own director door (${route.host})`;
    case "bridge":
      return `the Live Bridge (${route.host})`;
    case "harness":
      return `the director seam (${route.host})`;
    default:
      return "no director";
  }
}

/** A clock time for a status line ("3:24 PM"). */
export const clockTime = (at: number): string => new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/** `seenAt` is when a director last read the visit, if ever: the line
 *  states that moment rather than a fixed "15 seconds" (follow-up,
 *  Nov 7, 2026: the old wording read as a counter that never moved). */
export function visitStatusLine(director: VisitDirectorState, route: VisitRoute, seenAt: number | null = null): string {
  if (route.kind === "none") return "No director is named, so nobody can direct this visit.";
  switch (director) {
    case "live":
      return `Muse is directing through ${routeName(route)}.`;
    case "unreachable":
      return `The town cannot reach ${routeName(route)}; retrying every few seconds.`;
    case "refused":
      return `${routeName(route).replace(/^t/, "T")} refused this town's token; check Settings, Muse Visits.`;
    default:
      return seenAt === null
        ? `Connected to ${routeName(route)}. No director has checked in since the visit opened.`
        : `Connected to ${routeName(route)}. A director last checked in at ${clockTime(seenAt)}, and is not reading it now.`;
  }
}

/** A short chip line for the in-town indicator. */
export function visitChipLine(director: VisitDirectorState): string {
  switch (director) {
    case "live":
      return "Muse is here";
    case "unreachable":
      return "Reconnecting";
    case "refused":
      return "Token refused";
    default:
      return "Waiting for Muse";
  }
}

export type VisitCloseReason = "you" | "director" | "lapse";

export function visitClosedLine(reason: VisitCloseReason, lapseMs: number): string {
  const minutes = Math.round(lapseMs / 60_000);
  switch (reason) {
    case "you":
      return "Visit ended. Aelia is back in her own voice.";
    case "director":
      return "Muse ended the visit. Aelia is back in her own voice.";
    default:
      return `Visit closed: the town had no contact with a director for ${minutes} minutes.`;
  }
}

/** Minutes and seconds left, for the lapse warning. */
export function lapseCountdown(msLeft: number): string {
  const s = Math.max(0, Math.ceil(msLeft / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Whether the writing line should show right now. */
export function composingVisible(on: boolean, since: number | null, finalLineAt: number | null, now: number): boolean {
  if (!on) return false;
  if (finalLineAt !== null && now - finalLineAt < COMPOSING_SETTLE_MS) return false;
  if (since !== null && now - since > COMPOSING_STALE_MS) return false;
  return true;
}

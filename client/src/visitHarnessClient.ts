/**
 * The town's side of the director seam (Task 4, Nov 2026): one beat
 * against the local dev harness (harness/visitHarness.ts). Fetch only,
 * no retries, no queueing: a beat that fails is simply a beat without
 * a director, and the visit keeps its own heartbeat rules. Nothing
 * here runs unless a harness URL is configured and a visit is open (or
 * the idle glance is on), so the town stays offline otherwise.
 */
import { VISIT_POLL_MS, type ClientSyncRequest, type ClientSyncResponse } from "../../shared/visitProtocol";

export const DEFAULT_HARNESS_URL = "http://localhost:8787";
export const HARNESS_STORAGE_KEY = "muse-town-visit-harness";
/** The idle glance: with a harness configured and no visit open, the
 *  client looks for a director's begin request on this slow cadence. */
export const IDLE_GLANCE_MS = 10_000;

/** The harness URL, from ?harness= first, then localStorage, else the default. */
export function resolveHarnessUrl(search: string, read: (key: string) => string | null): string {
  try {
    const q = new URLSearchParams(search).get("harness");
    if (q) return q.replace(/\/+$/, "");
  } catch {
    /* no query */
  }
  const stored = read(HARNESS_STORAGE_KEY);
  return (stored && stored.trim()) || DEFAULT_HARNESS_URL;
}

export async function syncWithHarness(baseUrl: string, req: ClientSyncRequest, fetchImpl: typeof fetch = fetch): Promise<ClientSyncResponse | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), VISIT_POLL_MS - 500);
    const res = await fetchImpl(`${baseUrl}/visit/sync`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const body = (await res.json()) as ClientSyncResponse;
    if (!body || !Array.isArray(body.directions)) return null;
    return body;
  } catch {
    return null;
  }
}

import { readSaveEnvelope, type TownSave } from "../../shared/saveFormat";
import { VISITOR_TOKEN_HEADER } from "../../shared/visitProtocol";
import { isHostedTown, visitorToken } from "./hosted";

/**
 * Restore a save on the hosted town through its own route (Task 65): the
 * save is the raw body of POST /restore, not wrapped in the action JSON
 * that /actions caps at 2 MB, so a save of any size the format allows (32 MB)
 * gets through. Off the hosted web (the artifact and Android lines) the
 * ordinary action is used. The town's refusal is shown as it says it.
 */
export async function restoreSaveOverHttp(
  json: string,
  requestId: string,
  viaAction: (args: { json: string; request_id: string }) => Promise<unknown>,
  deps: { hosted?: boolean; fetchImpl?: typeof fetch; token?: () => string; origin?: string } = {},
): Promise<void> {
  if (!(deps.hosted ?? isHostedTown())) {
    await viaAction({ json, request_id: requestId });
    return;
  }
  const res = await (deps.fetchImpl ?? fetch)(`${deps.origin ?? "."}/restore?request_id=${encodeURIComponent(requestId)}`, {
    method: "POST",
    headers: { "content-type": "application/json", [VISITOR_TOKEN_HEADER]: (deps.token ?? visitorToken)() },
    body: json,
  });
  if (res.ok) return;
  let message = "";
  try {
    message = ((await res.json()) as { error?: string }).error ?? "";
  } catch {
    /* no body */
  }
  if (res.status === 413) message = "This save is larger than the town accepts (32 MB).";
  throw new Error(message || `The town could not restore that save (HTTP ${res.status}).`);
}

const localKeys = new Set([
  "muse-town-resume-v1", "muse-town-lowgfx", "muse-town-auto-graphics", "muse-town-arrival-enabled",
  "muse-town-met-cat", "muse-town-rejoin-hint-dismissed", "muse-town-chat-count", "muse-town-chapter",
  "muse-town-water-days", "muse-town-shard", "muse-town-greet-day", "muse-town-reunion-day",
  "muse-town-anniversary-day", "muse-town-appointment-day", "muse-town-chapter-day",
  "muse-town-lantern-day", "muse-town-question-day",
]);
export function addDeviceState(json: string, storage: Storage): string {
  const save = readSaveEnvelope(json);
  const client: Record<string, string> = {};
  for (const key of localKeys) {
    const value = storage.getItem(key);
    if (value !== null) client[key] = value;
  }
  save.client = client;
  const result = JSON.stringify(save);
  readSaveEnvelope(result);
  return result;
}
export function restoreDeviceState(save: TownSave, storage: Storage): void {
  for (const key of localKeys) {
    const value = save.client?.[key];
    if (typeof value === "string") storage.setItem(key, value);
    else storage.removeItem(key);
  }
  storage.removeItem("muse-town-arrival-v1");
  storage.removeItem("muse-town-pending-actions-v1");
}
export function saveDownload(json: string, suffix = "save"): void {
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `roman-muse-town-${suffix}-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}

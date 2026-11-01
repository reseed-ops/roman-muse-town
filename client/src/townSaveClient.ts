import { readSaveEnvelope, type TownSave } from "../../shared/saveFormat";

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

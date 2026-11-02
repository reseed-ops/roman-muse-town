export const SAVE_FORMAT = "roman-muse-town";
export const SAVE_VERSION = 1;
export const SAVE_SCHEMA_VERSION = 26;
export const MAX_SAVE_BYTES = 32 * 1024 * 1024;
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export interface TownSave {
  format: typeof SAVE_FORMAT;
  version: typeof SAVE_VERSION;
  schemaVersion: typeof SAVE_SCHEMA_VERSION;
  exportedAt: string;
  tables: Record<string, Record<string, string | number | null>[]>;
  attachments: { key: string; contentType: "image/jpeg"; base64: string }[];
  client?: Record<string, string>;
}

/** Cheap envelope check for the preview. The server validates every row,
 * column, attachment and version again before touching the database. */
export function readSaveEnvelope(json: string): TownSave {
  if (new TextEncoder().encode(json).length > MAX_SAVE_BYTES) throw new Error("This save is larger than the 32 MB limit.");
  const save: unknown = JSON.parse(json);
  if (!save || typeof save !== "object" || Array.isArray(save)) throw new Error("This is not a town save.");
  const value = save as Record<string, unknown>;
  if (value.format !== SAVE_FORMAT || value.version !== SAVE_VERSION || value.schemaVersion !== SAVE_SCHEMA_VERSION) throw new Error("This save uses an unsupported format or town version.");
  if (typeof value.exportedAt !== "string" || !Number.isFinite(Date.parse(value.exportedAt))) throw new Error("This save has an invalid date.");
  if (!value.tables || typeof value.tables !== "object" || Array.isArray(value.tables) || !Object.values(value.tables).every(Array.isArray) || !Array.isArray(value.attachments)) throw new Error("This save is missing town data.");
  if (value.client !== undefined && (!value.client || typeof value.client !== "object" || Array.isArray(value.client) || !Object.values(value.client).every((item) => typeof item === "string"))) throw new Error("This save has invalid device settings.");
  return value as unknown as TownSave;
}

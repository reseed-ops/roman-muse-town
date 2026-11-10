import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { getTableColumns, getTableName } from "drizzle-orm";
import type { AnySQLiteTable } from "drizzle-orm/sqlite-core";
import { UserFacingError } from "../../shared/userError";
import { MAX_ATTACHMENT_BYTES, MAX_EXPORT_BYTES, readSaveEnvelope, SAVE_FORMAT, SAVE_SCHEMA_VERSION, SAVE_VERSION, type TownSave } from "../../shared/saveFormat";
import * as schema from "./schema";
import { runRetrySafe } from "./retrySafe";
import { sqliteStorage, type TownDb, type TownStorage } from "./storage";

export interface BlobStore {
  getUrl(key: string): Promise<string>;
  put(key: string, data: Uint8Array, options: { contentType: string }): Promise<unknown>;
  delete(key: string): Promise<unknown>;
  /** A store that can hand its bytes over directly (the web server's,
   *  Task 8) skips the download through its own URL. */
  read?(key: string): Promise<Uint8Array | null>;
}
const tables = Object.values(schema) as AnySQLiteTable[];
const byName = new Map(tables.map((table) => [getTableName(table), table]));
const ownKeys = (value: object) => Object.keys(value).sort().join("\0");

function validateRows(save: TownSave): Map<AnySQLiteTable, Record<string, unknown>[]> {
  if (ownKeys(save.tables) !== [...byName.keys()].sort().join("\0")) throw new Error("The save does not contain the complete set of town tables.");
  const result = new Map<AnySQLiteTable, Record<string, unknown>[]>();
  for (const [name, table] of byName) {
    const columns = getTableColumns(table);
    const rows = save.tables[name]!;
    if (rows.length > 100000) throw new Error(`Too many rows in ${name}.`);
    result.set(table, rows.map((row) => {
      if (!row || typeof row !== "object" || Array.isArray(row) || ownKeys(row) !== ownKeys(columns)) throw new Error(`Invalid columns in ${name}.`);
      const decoded: Record<string, unknown> = {};
      for (const [key, column] of Object.entries(columns)) {
        const value = row[key];
        if (value === null && !column.notNull) { decoded[key] = null; continue; }
        if (column.dataType === "string") {
          if (typeof value !== "string") throw new Error(`Invalid text in ${name}.${key}.`);
          if (column.default === "[]" || column.default === "{}") {
            const parsed: unknown = JSON.parse(value);
            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) !== (column.default === "[]")) throw new Error(`Invalid stored list in ${name}.${key}.`);
          }
          decoded[key] = value;
        } else {
          if (typeof value !== "number" || !Number.isSafeInteger(value)) throw new Error(`Invalid number in ${name}.${key}.`);
          if (column.dataType === "date") {
            const date = new Date(value);
            if (!Number.isFinite(date.getTime())) throw new Error(`Invalid date in ${name}.${key}.`);
            decoded[key] = date;
          } else decoded[key] = value;
        }
      }
      return decoded;
    }));
  }
  return result;
}

/** What the actions allow into the tables the outside Muse and Aelia read.
 *  A save file is a stranger's data: without these, it could carry what no
 *  action would accept. Set above the action limits so old saves still load. */
const RESTORE_LIMITS: Record<string, { rows: number; text: Record<string, number> }> = {
  muse_notes: { rows: 5000, text: { text: 500 } },
  life_digest: { rows: 12, text: { text: 240 } },
  aelia_facts: { rows: 80, text: { text: 400 } },
  letters: { rows: 5000, text: { title: 200, body: 12000 } },
};

function checkRestoreLimits(save: TownSave): void {
  for (const [name, limit] of Object.entries(RESTORE_LIMITS)) {
    const rows = save.tables[name]!;
    if (rows.length > limit.rows) throw new Error(`Too many rows in ${name}.`);
    for (const row of rows) {
      for (const [column, max] of Object.entries(limit.text)) {
        if (String(row[column]).length > max) throw new Error(`Text too long in ${name}.${column}.`);
      }
    }
  }
  // The rest of the server trusts this shape on every landmark it records.
  for (const row of save.tables.affection_state!) {
    const discovered = (JSON.parse(String(row.flags)) as { discovered?: unknown }).discovered;
    if (discovered !== undefined && !(Array.isArray(discovered) && discovered.every((id) => typeof id === "string"))) {
      throw new Error("Invalid affection flags.");
    }
  }
}

function validateAttachments(save: TownSave): Map<string, Uint8Array> {
  const expected = new Set((save.tables.postcards ?? []).map((row) => row.blobKey));
  const attachments = new Map<string, Uint8Array>();
  for (const entry of save.attachments) {
    if (!entry || typeof entry.key !== "string" || !expected.has(entry.key) || attachments.has(entry.key) || entry.contentType !== "image/jpeg" || typeof entry.base64 !== "string" || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(entry.base64)) throw new Error("Invalid postcard attachment.");
    const bytes = Buffer.from(entry.base64, "base64");
    if (bytes.length < 3 || bytes.length > MAX_ATTACHMENT_BYTES || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) throw new Error("A postcard is not a supported JPEG image.");
    attachments.set(entry.key, bytes);
  }
  if (attachments.size !== expected.size) throw new Error("This save is missing postcard images.");
  return attachments;
}

const tooBig = (): UserFacingError =>
  new UserFacingError("This town's save is too large to export: its postcards and writing add up to more than the 32 MB a save may hold. Delete some postcards and try again. Nothing was changed.");

export async function exportTownSave(db: TownDb, blobs: BlobStore, fetchImage: typeof fetch = fetch, maxBytes: number = MAX_EXPORT_BYTES): Promise<string> {
  // One table after another is one consistent picture: the town runs one
  // action at a time (storage.ts), so nothing writes between these reads.
  const snapshot: Record<string, Record<string, unknown>[]> = {};
  for (const table of tables) {
    const rows = await db.select().from(table);
    snapshot[getTableName(table)] = rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value instanceof Date ? value.getTime() : value])));
  }
  const save: TownSave = { format: SAVE_FORMAT, version: SAVE_VERSION, schemaVersion: SAVE_SCHEMA_VERSION, exportedAt: new Date().toISOString(), tables: snapshot as TownSave["tables"], attachments: [] };
  let size = Buffer.byteLength(JSON.stringify(save));
  for (const key of new Set((save.tables.postcards ?? []).map((row) => String(row.blobKey)))) {
    if (blobs.read) {
      const bytes = await blobs.read(key);
      if (!bytes) throw new Error("A postcard could not be read. No incomplete save was exported.");
      if (bytes.length > MAX_ATTACHMENT_BYTES) throw new UserFacingError("A postcard is too large to export.");
      const base64 = Buffer.from(bytes).toString("base64");
      size += base64.length + key.length + 100;
      if (size > maxBytes) throw tooBig();
      save.attachments.push({ key, contentType: "image/jpeg", base64 });
      continue;
    }
    const response = await fetchImage(await blobs.getUrl(key), { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error("A postcard could not be downloaded. No incomplete save was exported.");
    if (Number(response.headers.get("content-length") ?? 0) > MAX_ATTACHMENT_BYTES) throw new UserFacingError("A postcard is too large to export.");
    const reader = response.body?.getReader();
    if (!reader) throw new Error("A postcard image was empty.");
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > MAX_ATTACHMENT_BYTES) throw new UserFacingError("A postcard is too large to export.");
        chunks.push(chunk.value);
      }
    } finally { await reader.cancel(); }
    const base64 = Buffer.concat(chunks).toString("base64");
    size += base64.length + key.length + 100;
    if (size > maxBytes) throw tooBig();
    save.attachments.push({ key, contentType: "image/jpeg", base64 });
  }
  validateRows(save);
  validateAttachments(save);
  const json = JSON.stringify(save);
  if (Buffer.byteLength(json) > maxBytes) throw tooBig();
  return json;
}

export async function restoreTownSave(db: TownDb, blobs: BlobStore, json: string, requestId?: string, storage: TownStorage = sqliteStorage): Promise<void> {
  const save = readSaveEnvelope(json);
  const decoded = validateRows(save);
  checkRestoreLimits(save);
  const attachments = validateAttachments(save);
  const uploaded: string[] = [];
  try {
    const replacement = new Map<string, string>();
    for (const [key, bytes] of attachments) {
      const next = `postcards/restored-${randomUUID()}.jpg`;
      // Track before put: a lost upload acknowledgement may still leave a blob.
      uploaded.push(next);
      await blobs.put(next, bytes, { contentType: "image/jpeg" });
      replacement.set(key, next);
    }
    for (const row of decoded.get(schema.postcards) ?? []) row.blobKey = replacement.get(String(row.blobKey));
    // The images the town held before: once the restore lands they are
    // superseded and are deleted (Task 64), never left behind as orphans.
    const superseded = (await db.select({ key: schema.postcards.blobKey }).from(schema.postcards)).map((row) => row.key);
    const applied = await runRetrySafe(storage, db, { requestId, action: "restoreSave", payload: { json } }, async (tx) => {
      for (const table of tables) await tx.delete(table);
      for (const [table, rows] of decoded) {
        // Small batches keep SQLite's variable limit independent of save size.
        const batchSize = Math.max(1, Math.floor(500 / Object.keys(getTableColumns(table)).length));
        for (let i = 0; i < rows.length; i += batchSize) await tx.insert(table).values(rows.slice(i, i + batchSize));
      }
      await storage.afterRestore(tx);
    });
    if (!applied) await Promise.allSettled(uploaded.map((key) => blobs.delete(key)));
    else await Promise.allSettled(superseded.filter((key) => !uploaded.includes(key)).map((key) => blobs.delete(key)));
  } catch (error) {
    await Promise.allSettled(uploaded.map((key) => blobs.delete(key)));
    throw error;
  }
}

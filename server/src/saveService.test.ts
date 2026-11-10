import { afterEach, beforeEach, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";
import { exportTownSave, restoreTownSave } from "./saveService";
import { runRetrySafe } from "./retrySafe";
import { sqliteStorage } from "./storage";

let sqlite: Database;
let db: ReturnType<typeof drizzle<typeof schema>>;
let stored: Map<string, Uint8Array>;
const jpeg = new Uint8Array([255, 216, 255, 217]);
const blobs = {
  async getUrl(key: string) { return `https://example.test/${key}`; },
  async put(key: string, bytes: Uint8Array) { stored.set(key, bytes); },
  async delete(key: string) { stored.delete(key); },
};
const fetchImage = (async () => new Response(jpeg)) as unknown as typeof fetch;
beforeEach(() => {
  sqlite = new Database(":memory:");
  const directory = new URL("../../drizzle/", import.meta.url);
  for (const file of readdirSync(directory).filter((file) => file.endsWith(".sql")).sort()) sqlite.exec(readFileSync(new URL(file, directory), "utf8"));
  db = drizzle(sqlite, { schema }); stored = new Map();
  db.insert(schema.journal).values({ text: "A private memory", createdAt: new Date(123000) }).run();
  db.insert(schema.postcards).values({ blobKey: "original.jpg", caption: "By the tree", dateLabel: "Today", createdAt: new Date(456000) }).run();
});
afterEach(() => sqlite.close());

test("save round trip preserves writing, timestamps and embedded postcards", async () => {
  const json = await exportTownSave(db, blobs, fetchImage);
  db.delete(schema.journal).run();
  await restoreTownSave(db, blobs, json);
  expect(db.select().from(schema.journal).get()?.text).toBe("A private memory");
  expect(db.select().from(schema.journal).get()?.createdAt.getTime()).toBe(123000);
  const photo = db.select().from(schema.postcards).get()!;
  expect(photo.caption).toBe("By the tree"); expect(photo.blobKey).not.toBe("original.jpg");
  expect(stored.get(photo.blobKey)).toEqual(jpeg);
});

test("malformed or incomplete saves leave the current town untouched", async () => {
  const original = JSON.parse(await exportTownSave(db, blobs, fetchImage));
  for (const mutate of [
    (save: typeof original) => { delete save.tables.journal; },
    (save: typeof original) => { save.attachments = []; },
    (save: typeof original) => { save.schemaVersion++; },
    (save: typeof original) => { save.tables.journal[0].createdAt = "yesterday"; },
  ]) {
    const save = structuredClone(original); mutate(save);
    await expect(restoreTownSave(db, blobs, JSON.stringify(save))).rejects.toThrow();
    expect(db.select().from(schema.journal).all()).toHaveLength(1); expect(stored.size).toBe(0);
  }
});

test("database restore failure rolls back all tables and removes new image uploads", async () => {
  const json = await exportTownSave(db, blobs, fetchImage);
  sqlite.exec("CREATE TRIGGER fail_restore BEFORE INSERT ON journal BEGIN SELECT RAISE(ABORT, 'restore failure'); END");
  await expect(restoreTownSave(db, blobs, json)).rejects.toThrow("restore failure");
  expect(db.select().from(schema.journal).get()?.text).toBe("A private memory");
  expect(db.select().from(schema.postcards).get()?.blobKey).toBe("original.jpg");
  expect(stored.size).toBe(0);
});

test("lost upload acknowledgement cleans up without replacing the town", async () => {
  const json = await exportTownSave(db, blobs, fetchImage);
  await expect(restoreTownSave(db, { ...blobs, async put(key, bytes) { stored.set(key, bytes); throw new Error("upload failed"); } }, json)).rejects.toThrow("upload failed");
  expect(stored.size).toBe(0); expect(db.select().from(schema.journal).all()).toHaveLength(1);
});

test("retrying a committed restore preserves changes made after it", async () => {
  const json = await exportTownSave(db, blobs, fetchImage);
  await restoreTownSave(db, blobs, json, "restore-id");
  db.insert(schema.journal).values({ text: "After restore" }).run();
  await restoreTownSave(db, blobs, json, "restore-id");
  expect(db.select().from(schema.journal).all()).toHaveLength(2);
  expect(stored.size).toBe(1);
});

test("request receipts reject payload reuse and roll back with failed work", async () => {
  const identity = { requestId: "purchase-id", action: "purchase", payload: { amount: 1 } };
  const work = async (tx: Parameters<Parameters<typeof runRetrySafe>[3]>[0]): Promise<void> => { await tx.insert(schema.journal).values({ text: "purchase" }); };
  expect(await runRetrySafe(sqliteStorage, db, identity, work)).toBe(true);
  expect(await runRetrySafe(sqliteStorage, db, identity, work)).toBe(false);
  await expect(runRetrySafe(sqliteStorage, db, { ...identity, payload: { amount: 2 } }, work)).rejects.toThrow("different action");
  await expect(runRetrySafe(sqliteStorage, db, { ...identity, requestId: "failed-id" }, async (tx) => { await work(tx); throw new Error("failure"); })).rejects.toThrow("failure");
  expect(db.select().from(schema.journal).all()).toHaveLength(2);
  expect(db.select().from(schema.requestReceipts).all()).toHaveLength(1);
});

test("a save carrying what no action would accept is refused", async () => {
  const original = JSON.parse(await exportTownSave(db, blobs, fetchImage));
  for (const mutate of [
    (save: typeof original) => { save.tables.muse_notes.push({ id: 1, text: "x".repeat(501), done: 0, createdAt: 1 }); },
    (save: typeof original) => { save.tables.aelia_facts = Array.from({ length: 81 }, (_, id) => ({ id, text: "x", topic: "life", learnedOn: "", source: "chat", surfacedOn: null })); },
    (save: typeof original) => { save.tables.life_digest.push({ id: 1, text: "x".repeat(241), expiresOn: "", followUp: 0, questId: null, asked: 0 }); },
    (save: typeof original) => { save.tables.affection_state = [{ id: 1, points: 0, dayKey: "", caps: "{}", flags: '{"discovered":"forum"}', lastContactAt: null }]; },
  ]) {
    const save = structuredClone(original); mutate(save);
    await expect(restoreTownSave(db, blobs, JSON.stringify(save))).rejects.toThrow();
    expect(db.select().from(schema.journal).all()).toHaveLength(1); expect(stored.size).toBe(0);
  }
});

test("limits never stop the town backing up what it already holds", async () => {
  db.insert(schema.museNotes).values({ text: "x".repeat(600) }).run();
  expect(await exportTownSave(db, blobs, fetchImage)).toContain("xxxx");
});

test("Task 64: a successful restore deletes the images it superseded, and a failed one keeps them", async () => {
  stored.set("original.jpg", jpeg);
  const json = await exportTownSave(db, blobs, fetchImage);
  // A failed restore leaves the old image where it was.
  sqlite.exec("CREATE TRIGGER fail_restore BEFORE INSERT ON journal BEGIN SELECT RAISE(ABORT, 'restore failure'); END");
  await expect(restoreTownSave(db, blobs, json)).rejects.toThrow("restore failure");
  expect(stored.has("original.jpg")).toBe(true);
  sqlite.exec("DROP TRIGGER fail_restore");
  // A successful one replaces it: the new key is held, the old blob is gone, nothing is orphaned.
  await restoreTownSave(db, blobs, json);
  const photo = db.select().from(schema.postcards).get()!;
  expect(photo.blobKey).not.toBe("original.jpg");
  expect([...stored.keys()]).toEqual([photo.blobKey]);
});

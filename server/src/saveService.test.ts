import { afterEach, beforeEach, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";
import { exportTownSave, restoreTownSave } from "./saveService";
import { runRetrySafe } from "./retrySafe";

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

test("request receipts reject payload reuse and roll back with failed work", () => {
  const identity = { requestId: "purchase-id", action: "purchase", payload: { amount: 1 } };
  const work = (tx: Parameters<Parameters<typeof runRetrySafe>[2]>[0]): undefined => { tx.insert(schema.journal).values({ text: "purchase" }).run(); };
  expect(runRetrySafe(db, identity, work)).toBe(true);
  expect(runRetrySafe(db, identity, work)).toBe(false);
  expect(() => runRetrySafe(db, { ...identity, payload: { amount: 2 } }, work)).toThrow("different action");
  expect(() => runRetrySafe(db, { ...identity, requestId: "failed-id" }, (tx) => { work(tx); throw new Error("failure"); })).toThrow("failure");
  expect(db.select().from(schema.journal).all()).toHaveLength(2);
  expect(db.select().from(schema.requestReceipts).all()).toHaveLength(1);
});

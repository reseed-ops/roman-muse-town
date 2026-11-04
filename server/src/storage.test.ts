import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";
import { oneTownAtATime, sqliteStorage, storageOf, type TownDb } from "./storage";

function freshTown(): { sqlite: Database; db: TownDb } {
  const sqlite = new Database(":memory:");
  const directory = new URL("../../drizzle/", import.meta.url);
  for (const file of readdirSync(directory).filter((file) => file.endsWith(".sql")).sort()) sqlite.exec(readFileSync(new URL(file, directory), "utf8"));
  return { sqlite, db: drizzle(sqlite, { schema }) };
}

describe("the action layer stays dialect-neutral", () => {
  test("no synchronous driver call remains in the server", () => {
    const directory = new URL("./", import.meta.url);
    const offenders: string[] = [];
    for (const file of readdirSync(directory).filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))) {
      const source = readFileSync(new URL(file, directory), "utf8");
      // storage.ts owns the two dialect-specific statements and the transaction.
      if (file === "storage.ts" || file === "storage.pg.ts") continue;
      for (const [index, line] of source.split("\n").entries()) {
        if (/\.(all|get|run)\(\)/.test(line) || /db\.transaction\(/.test(line)) offenders.push(`${file}:${index + 1}: ${line.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test("the SQLite line is the default; a storage on the context wins", () => {
    expect(storageOf({}).dialect).toBe("sqlite");
    expect(storageOf({ storage: { ...sqliteStorage, dialect: "postgres" } }).dialect).toBe("postgres");
  });
});

describe("the SQLite storage", () => {
  test("a transaction commits what resolves and rolls back what throws", async () => {
    const { sqlite, db } = freshTown();
    await sqliteStorage.transaction(db, async (tx) => { await tx.insert(schema.journal).values({ text: "kept" }); });
    await expect(sqliteStorage.transaction(db, async (tx) => {
      await tx.insert(schema.journal).values({ text: "lost" });
      throw new Error("failure");
    })).rejects.toThrow("failure");
    expect((await db.select().from(schema.journal)).map((row) => row.text)).toEqual(["kept"]);
    sqlite.close();
  });

  test("an inner transaction joins the outer one and falls with it", async () => {
    const { sqlite, db } = freshTown();
    await expect(sqliteStorage.transaction(db, async (tx) => {
      await sqliteStorage.transaction(tx, async (inner) => { await inner.insert(schema.journal).values({ text: "inner" }); });
      throw new Error("outer failure");
    })).rejects.toThrow("outer failure");
    expect(await db.select().from(schema.journal)).toHaveLength(0);
    // The database is usable again: nothing was left open.
    await sqliteStorage.transaction(db, async (tx) => { await tx.insert(schema.journal).values({ text: "after" }); });
    expect(await db.select().from(schema.journal)).toHaveLength(1);
    sqlite.close();
  });

  test("serialized work never interleaves, and a failure does not jam the queue", async () => {
    const trace: string[] = [];
    const slow = (name: string, fail = false) => sqliteStorage.serialize(async () => {
      trace.push(`${name}:start`);
      await new Promise((resolve) => setTimeout(resolve, 5));
      trace.push(`${name}:end`);
      if (fail) throw new Error(name);
      return name;
    });
    const results = await Promise.allSettled([slow("a"), slow("b", true), slow("c")]);
    expect(trace).toEqual(["a:start", "a:end", "b:start", "b:end", "c:start", "c:end"]);
    expect(results.map((result) => result.status)).toEqual(["fulfilled", "rejected", "fulfilled"]);
  });

  test("oneTownAtATime keeps the definition and serializes its handler", async () => {
    const seen: number[] = [];
    const definition = {
      description: "test",
      async handler(_ctx: object, args: { n: number }) {
        seen.push(args.n);
        await new Promise((resolve) => setTimeout(resolve, 2));
        seen.push(-args.n);
        return args.n;
      },
    };
    const wrapped = oneTownAtATime(definition);
    expect(wrapped.description).toBe("test");
    const results = await Promise.all([wrapped.handler({}, { n: 1 }), wrapped.handler({}, { n: 2 })]);
    expect(results).toEqual([1, 2]);
    expect(seen).toEqual([1, -1, 2, -2]);
  });
});

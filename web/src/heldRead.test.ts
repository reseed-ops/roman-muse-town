import { expect, test } from "bun:test";
import { townSchemaName } from "../../server/src/storage.pg";
import { createSlateFace } from "../../shared/slateFace";
import { createTownServer } from "./server";

// Held reads (Task 41): a pull may wait for news instead of the town
// asking every two seconds. No database is involved in these routes.

const A = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
const pull = (server: ReturnType<typeof createTownServer>, q: string) =>
  server.fetch(new Request(`http://town.test/bridge/directions?${q}`, { headers: { authorization: `Bearer ${A}` } }));

test("news spends nothing until it is pulled: a begin request stays for the pull", () => {
  const face = createSlateFace();
  expect(face.hasNews(0)).toBe(false);
  face.requestBegin();
  expect(face.hasNews(0)).toBe(true);
  expect(face.hasNews(0)).toBe(true);
  expect(face.pull(0).begin).toBe(true);
  expect(face.hasNews(0)).toBe(false);
  // The composing flag differing from the client's counts as news.
  expect(face.hasNews(0, true)).toBe(true);
  expect(face.hasNews(0, false)).toBe(false);
});

test("a held read answers at once when news waits, holds when none does, and ends early when it comes", async () => {
  const server = createTownServer({ db: null as never, actions: {}, directorToken: null, blobSecret: "s", distDir: null });
  const face = server.slates.faceFor(townSchemaName(A));
  face.requestBegin();
  let t = performance.now();
  const quick = (await (await pull(server, "since=0&wait=5")).json()) as { begin?: boolean };
  expect(quick.begin).toBe(true);
  expect(performance.now() - t).toBeLessThan(400);
  // Nothing new: it holds about the wait asked for.
  t = performance.now();
  await pull(server, "since=0&wait=1");
  expect(performance.now() - t).toBeGreaterThan(900);
  // News arriving during the hold ends it early.
  t = performance.now();
  setTimeout(() => face.requestBegin(), 300);
  const early = (await (await pull(server, "since=0&wait=5")).json()) as { begin?: boolean };
  expect(early.begin).toBe(true);
  expect(performance.now() - t).toBeLessThan(1500);
  // No wait asked: the old immediate answer.
  t = performance.now();
  await pull(server, "since=0");
  expect(performance.now() - t).toBeLessThan(300);
});

import { expect, test } from "bun:test";
import { DIRECTOR_TOKEN_HEADER } from "../../shared/visitProtocol";
import { createPairingDesk, normalizePairCode, PAIR_CODE_MS, PAIR_MISS_LIMIT } from "./pairing";
import { createTownServer } from "./server";

// Task 29: pairing codes. No database is needed: the bridge routes and
// the redeem route never touch one.

const A = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
const B = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";
const DIRECTOR = "director-secret-for-tests-0001";

test("a code is single use, names one town, and a new code replaces the old", () => {
  let t = 1_000;
  const desk = createPairingDesk({ now: () => t });
  const a1 = desk.mint(A);
  expect(a1.code).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
  const a2 = desk.mint(A);
  expect(desk.redeem(a1.code)).toEqual({ ok: false, reason: "unknown" });
  const b = desk.mint(B);
  // Lower case and stray spaces still read.
  expect(desk.redeem(` ${a2.code.toLowerCase()} `)).toEqual({ ok: true, visitorToken: A });
  expect(desk.redeem(a2.code)).toEqual({ ok: false, reason: "unknown" });
  expect(desk.redeem(b.code)).toEqual({ ok: true, visitorToken: B });
  // Expiry.
  const late = desk.mint(A);
  t += PAIR_CODE_MS + 1;
  expect(desk.redeem(late.code)).toEqual({ ok: false, reason: "unknown" });
  expect(normalizePairCode("abc")).toBeNull();
});

test("repeated misses lock redeeming for the window, even for a real code", () => {
  let t = 5_000;
  const desk = createPairingDesk({ now: () => t });
  const real = desk.mint(A);
  for (let i = 0; i < PAIR_MISS_LIMIT; i++) desk.redeem("ZZZZZ-ZZZZZ");
  expect(desk.redeem(real.code)).toEqual({ ok: false, reason: "locked" });
  t += 61_000;
  expect(desk.redeem(real.code)).toEqual({ ok: true, visitorToken: A });
});

test("the town mints a code for its own visitor, and only the director token redeems it", async () => {
  const logs: string[] = [];
  const server = createTownServer({ db: null as never, actions: {}, directorToken: DIRECTOR, blobSecret: "blob-secret", distDir: null, log: (l) => logs.push(l) });
  const minted = await server.fetch(new Request("http://town.test/bridge/pair", { method: "POST", headers: { authorization: `Bearer ${A}` } }));
  expect(minted.status).toBe(200);
  const { code } = (await minted.json()) as { code: string };
  // No visitor key, no code.
  expect((await server.fetch(new Request("http://town.test/bridge/pair", { method: "POST" }))).status).toBe(401);
  const redeem = (token: string | null, body: unknown) =>
    server.fetch(new Request("http://town.test/director/pair-redeem", {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { [DIRECTOR_TOKEN_HEADER]: token } : {}) },
      body: JSON.stringify(body),
    }));
  // Without the director token the route does not exist, and the code survives.
  expect((await redeem(null, { code })).status).toBe(404);
  expect((await redeem("wrong-director", { code })).status).toBe(404);
  const ok = await redeem(DIRECTOR, { code });
  expect(ok.status).toBe(200);
  expect(await ok.json()).toEqual({ visitorToken: A });
  expect((await redeem(DIRECTOR, { code })).status).toBe(404);
  for (const line of logs) {
    expect(line).not.toContain(A);
    expect(line).not.toContain(DIRECTOR);
    expect(line).not.toContain(code);
  }
});

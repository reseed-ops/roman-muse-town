import { expect, test } from "bun:test";
import { beginVisit, captureMail, emptySlate, stateView } from "../../client/src/visitSlate";
import { createCostLedger } from "./costCaps.js";
import { createDirector } from "./director.js";
import type { Mind } from "./mind.js";
import { createPackLoader } from "./pack.js";
import { bearerToken, startBridgeServer, tokenMatches } from "./bridgeServer.js";
import { createSlateFace } from "./slateFace.js";

// The director face over real HTTP: the token gate on both endpoints,
// a snapshot-to-answer round trip against a stub mind (mail arrives in
// a snapshot, the answer leaves as a speak on the next pull), and the
// lapse (snapshots stop, the bridge goes quiet, nothing is enqueued).

const PACK = "rank: 4\n## Identity\nShe is the hostess.\n## Voice\nWarm.\n## Constitution\nDirections only.\n## Life digest\nIt rained.";
const TOKEN = "test-token-not-a-real-one";

function stubMind(): Mind {
  return {
    async compose(_input, onText) {
      onText("There you are, by the lake.");
      return { text: "There you are, by the lake.", usage: { outputTokens: 8, inputTokens: 100 }, refused: false };
    },
    async intend() {
      return { text: "She means to sit a while.", usage: { outputTokens: 4, inputTokens: 50 } };
    },
  };
}

async function setup(lapseMs = 10_000) {
  const clock = { t: 8_000_000 };
  const face = createSlateFace({ now: () => clock.t, lapseMs });
  const log: string[] = [];
  const server = await startBridgeServer({ face, token: TOKEN, port: 0, host: "127.0.0.1", log: (l) => log.push(l) });
  const base = `http://127.0.0.1:${server.port}`;
  const pack = createPackLoader({ read: async () => ({ text: PACK, mtimeMs: 1 }) });
  await pack.check();
  const ledger = createCostLedger({ dailyCalls: 100, dailyOutputTokens: 10_000, dailyFrames: 10 }, { dayKey: () => "d" });
  const director = createDirector({
    channel: face.channel, mind: stubMind(), pack, ledger, now: () => clock.t, log: (l) => log.push(l),
    config: { enabled: true, pollMs: 2000, intentionEveryMs: 600_000, sightEveryMs: 600_000 },
  });
  const auth = { authorization: `Bearer ${TOKEN}` };
  const post = (body: unknown, headers: Record<string, string> = auth) =>
    fetch(`${base}/bridge/snapshot`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
  const pull = (since: number, headers: Record<string, string> = auth) => fetch(`${base}/bridge/directions?since=${since}`, { headers });
  return { clock, face, server, base, log, director, post, pull };
}

test("both endpoints refuse a missing or wrong token quietly, and the log never carries the value", async () => {
  const { server, base, log, post, pull } = await setup();
  try {
    const slate = beginVisit(emptySlate(), 1);
    const body = { state: stateView(slate), mail: [], frame: null };
    expect((await post(body, {})).status).toBe(401);
    expect((await post(body, { authorization: "Bearer wrong-token-value" })).status).toBe(401);
    expect((await post(body, { authorization: "Basic abc" })).status).toBe(401);
    expect((await pull(0, {})).status).toBe(401);
    expect((await pull(0, { authorization: `Bearer ${TOKEN}x` })).status).toBe(401);
    expect(await (await pull(0, {})).json()).toEqual({ error: "refused" });
    // A refused snapshot is not held.
    expect((await pull(0)).status).toBe(200);
    expect(await (await pull(0)).json()).toEqual({ directions: [], composing: false, directorSeenAt: null });
    expect(log.filter((l) => l.startsWith("refused")).length).toBe(6);
    for (const l of log) {
      expect(l).not.toContain(TOKEN);
      expect(l).not.toContain("wrong-token-value");
    }
    // Other routes are not there; the preflight needs no token and names the header.
    expect((await fetch(`${base}/visit/state`)).status).toBe(404);
    const cors = await fetch(`${base}/bridge/snapshot`, { method: "OPTIONS" });
    expect(cors.status).toBe(204);
    expect(cors.headers.get("access-control-allow-headers")).toContain("authorization");
  } finally {
    await server.close();
  }
});

test("tokenMatches is total and the bearer parser is strict", () => {
  expect(tokenMatches(TOKEN, TOKEN)).toBe(true);
  expect(tokenMatches("x", TOKEN)).toBe(false);
  expect(tokenMatches(null, TOKEN)).toBe(false);
  expect(tokenMatches("", "")).toBe(false);
  expect(tokenMatches(TOKEN, "")).toBe(false);
  expect(bearerToken(`Bearer ${TOKEN}`)).toBe(TOKEN);
  expect(bearerToken(`bearer ${TOKEN}`)).toBe(TOKEN);
  expect(bearerToken(TOKEN)).toBeNull();
  expect(bearerToken(undefined)).toBeNull();
  expect(bearerToken("Bearer ")).toBeNull();
});

test("a snapshot-to-answer round trip: mail arrives in a snapshot, the answer leaves as a speak on the next pull", async () => {
  const { clock, server, log, director, post, pull } = await setup();
  try {
    let slate = beginVisit(emptySlate(), clock.t);
    expect(await (await post({ state: stateView(slate), mail: [], frame: null })).json()).toEqual({ ok: true, latestSeq: 0, frameId: null });
    expect((await director.tick()).kind).toBe("greeted");
    const greeted = await (await pull(0)).json();
    expect(greeted.directions.map((q: { direction: unknown }) => q.direction)).toEqual([{ kind: "speak", text: "There you are. I was hoping you'd come by." }]);
    expect(greeted.directorSeenAt).toBe(clock.t);
    // His letter lands in the next snapshot; the director answers it;
    // the client's next pull (past the greeting) carries her answer.
    slate = captureMail(slate, "Where are you?", clock.t + 1).slate;
    expect(await (await post({ state: stateView(slate), mail: slate.inbox, frame: null })).json()).toEqual({ ok: true, latestSeq: 1, frameId: null });
    expect((await director.tick()).kind).toBe("answered");
    const answered = await (await pull(1)).json();
    const speaks = answered.directions.filter((q: { direction: { kind: string } }) => q.direction.kind === "speak");
    expect(speaks[speaks.length - 1].direction).toEqual({ kind: "speak", text: "There you are, by the lake.", lineId: expect.stringMatching(/^L\d+-1$/) });
    expect(speaks.every((q: { id: number }) => q.id > 1)).toBe(true);
    // Composing went on and off around the answer, and reads off now.
    expect(answered.composing).toBe(false);
    // Mail already handed over is not answered twice.
    expect((await director.tick()).kind).toBe("idle");
    expect(log.some((l) => l.startsWith("refused"))).toBe(false);
    // A direction the seam validator refuses never reaches the queue.
    expect(await (await post({ state: stateView(slate), mail: [], frame: null })).json()).toEqual({ ok: true, latestSeq: 1, frameId: null });
    const bad = await (await post({ state: { ...stateView(slate), active: 1 }, mail: [], frame: null })).json();
    expect(bad).toEqual({ ok: false, error: "state.active is a boolean" });
  } finally {
    await server.close();
  }
});

test("the lapse: snapshots stop, the bridge goes quiet, and nothing is enqueued", async () => {
  const { clock, face, server, log, director, post, pull } = await setup(10_000);
  try {
    const slate = beginVisit(emptySlate(), clock.t);
    await post({ state: stateView(slate), mail: [], frame: null });
    expect((await director.tick()).kind).toBe("greeted");
    expect((await director.tick()).kind).toBe("idle");
    // A direction left for the client, then no snapshot for longer than
    // the lapse window: the direction dies with the slate.
    await face.channel.direct({ kind: "sit" });
    clock.t += 10_001;
    expect((await director.tick()).kind).toBe("closed");
    expect(log.some((l) => l.includes("the visit closed; forgetting it"))).toBe(true);
    expect(director.memory()).toBeNull();
    const after = await (await pull(0)).json();
    expect(after.directions).toEqual([]);
    expect(after.composing).toBe(false);
    expect(await face.channel.direct({ kind: "speak", text: "Still here?" })).toEqual({ ok: false, error: "no visit is open" });
    // Quiet: further ticks read closed and enqueue nothing.
    expect((await director.tick()).kind).toBe("closed");
    expect((await pull(0)).status).toBe(200);
    expect((await (await pull(0)).json()).directions).toEqual([]);
  } finally {
    await server.close();
  }
});

import { expect, test } from "bun:test";
import type { VisitTelemetry } from "../../shared/visitProtocol.js";
import { createCostLedger } from "./costCaps.js";
import { createDirector } from "./director.js";
import { createFakeChannel } from "./fakeChannel.js";
import type { Mind } from "./mind.js";
import { createPackLoader } from "./pack.js";
import { createPrincipalDesk, parsePrincipalCall, sceneChangedMaterially, PRINCIPAL_CLAIM_MS, type PrincipalSlate } from "./principal.js";
import { startPrincipalServer } from "./principalServer.js";

// Task 22: the principal channel. Her claim silences the resident, which
// only relays; the claim lapses after three minutes without a call and
// the resident resumes; a landed line is acknowledged with presence
// only; a sequence of beats is performed at its authored delays and its
// remainder dropped when he replies; refusals come back on her next
// slate; the server answers only to her token, and a rotated token
// refuses the old one.

const PACK = "rank: 0\n## Identity\nShe is the hostess.\n## Voice\nWarm.\n## Constitution\nDirections only.\n## Life digest\nThe town is new.";

const tel = (over: Partial<VisitTelemetry> = {}): VisitTelemetry => ({
  museZone: "tree", gaiusZone: "tree", museSeated: false, gaiusSeated: false, gaiusWalking: false, dayPhase: "day",
  museX: 0, museZ: 0, gaiusX: 1, gaiusZ: 0, museHeading: 0, gaiusHeading: 0, bearingToGaius: 0, distanceToGaius: 1, pad2Source: "none", ...over,
});

function setup() {
  const clock = { t: 1_000_000 };
  const channel = createFakeChannel();
  const mind = {
    composed: 0,
    async compose(_input, onText) {
      mind.composed += 1;
      onText("The resident answers.");
      return { text: "The resident answers.", usage: { outputTokens: 5, inputTokens: 50 }, refused: false };
    },
    async intend() {
      return { text: "She means to stay.", usage: { outputTokens: 3, inputTokens: 20 } };
    },
  } satisfies Mind & { composed: number };
  const pack = createPackLoader({ read: async () => ({ text: PACK, mtimeMs: 1 }) });
  const ledger = createCostLedger({ dailyCalls: 100, dailyOutputTokens: 10_000, dailyFrames: 10 }, { dayKey: () => "d" });
  const log: string[] = [];
  const desk = createPrincipalDesk({ channel, rank: () => pack.current().rank ?? 0, now: () => clock.t, log: (l) => log.push(l) });
  const director = createDirector({
    channel, mind, pack, ledger, principal: desk, now: () => clock.t, log: (l) => log.push(l),
    config: { enabled: true, pollMs: 2000, intentionEveryMs: 10_000, sightEveryMs: 20_000, staleFrameMs: 60_000, partialEveryMs: 700 },
  });
  const speaks = () => channel.directions.filter((d) => d.direction.kind === "speak").map((d) => (d.direction as { text: string }).text);
  const wake = async (body: unknown): Promise<PrincipalSlate> => {
    const r = await desk.wake(body);
    if (!r.ok) throw new Error(r.error);
    return r.slate;
  };
  return { clock, channel, mind, pack, desk, director, log, speaks, wake };
}

test("her claim silences the resident: no greeting, no answer; her line is delivered and his line waits for her", async () => {
  const { clock, channel, mind, pack, director, speaks, wake } = setup();
  await pack.check();
  channel.open(clock.t, tel());
  let slate = await wake({});
  expect(slate.claim.live).toBe(true);
  expect(slate.claim.expiresAt).toBe(clock.t + PRINCIPAL_CLAIM_MS);
  expect(slate.reports.map((r) => r.kind)).toEqual(["claim"]);
  expect((await director.tick()).kind).toBe("relayed");
  expect(speaks()).toEqual([]); // no resident greeting while she attends
  clock.t += 1000;
  channel.mail("What do you remember of the lake?", clock.t);
  clock.t += 1000;
  expect((await director.tick()).kind).toBe("relayed");
  expect(mind.composed).toBe(0);
  clock.t += 30_000;
  slate = await wake({});
  expect(slate.waiting.map((l) => l.text)).toEqual(["What do you remember of the lake?"]);
  expect(slate.latestSeq).toBe(1);
  clock.t += 20_000;
  slate = await wake({ seen: 1, direction: { kind: "speak", text: "The boat, and you rowing us in circles." } });
  expect(speaks()).toEqual(["The boat, and you rowing us in circles."]);
  expect(slate.waiting).toEqual([]);
  expect(slate.transcript.map((l) => `${l.who}${l.by ? `/${l.by}` : ""}: ${l.text}`)).toEqual([
    "him: What do you remember of the lake?",
    "her/principal: The boat, and you rowing us in circles.",
  ]);
  expect(slate.reports.find((r) => r.kind === "performed")).toMatchObject({ beat: 1, of: 1, condition: "none" });
  expect(mind.composed).toBe(0);
});

test("the claim lapses three minutes after her last call; the resident resumes and answers a fresh line, not the old one", async () => {
  const { clock, channel, mind, pack, desk, director, log, speaks, wake } = setup();
  await pack.check();
  channel.open(clock.t, tel());
  await director.tick(); // the resident greets before she arrives
  expect(speaks()).toEqual(["There you are. I was hoping you'd come by."]);
  await wake({});
  clock.t += 5000;
  channel.mail("Are you there?", clock.t);
  await director.tick();
  expect(mind.composed).toBe(0);
  clock.t += PRINCIPAL_CLAIM_MS - 6000; // 179 s after her call: still hers
  expect(desk.live()).toBe(true);
  expect((await director.tick()).kind).toBe("relayed");
  clock.t += 1000; // 180 s: lapsed
  expect(desk.live()).toBe(false);
  expect(log.some((l) => l.startsWith("principal claim lapsed: no call for 180 s"))).toBe(true);
  expect(channel.composing).toBe(false);
  expect((await director.tick()).kind).toBe("idle"); // the line from the claim is not answered twice
  expect(mind.composed).toBe(0);
  clock.t += 2000;
  channel.mail("Hello again?", clock.t);
  expect((await director.tick()).kind).toBe("answered");
  expect(mind.composed).toBe(1);
  expect(speaks().at(-1)).toBe("The resident answers.");
});

test("releasing the claim hands the visit back at once", async () => {
  const { clock, channel, pack, desk, director, wake } = setup();
  await pack.check();
  channel.open(clock.t, tel());
  await wake({});
  const slate = await wake({ attend: false });
  expect(slate.claim.live).toBe(false);
  expect(desk.live()).toBe(false);
  expect((await director.tick()).kind).toBe("greeted");
});

test("acknowledgment staging: a landed line turns her to him (or walks her to him) and shows her composing, with no words", async () => {
  const { clock, channel, pack, director, log, wake } = setup();
  await pack.check();
  channel.open(clock.t, tel({ distanceToGaius: 9, museZone: "forum", gaiusZone: "tree" }));
  await wake({});
  clock.t += 2000;
  channel.mail("Come here a moment.", clock.t);
  await director.tick();
  expect(channel.directions.map((d) => d.direction)).toEqual([{ kind: "goto", anchor: "gaius" }]);
  expect(channel.composing).toBe(true);
  expect(log.some((l) => l === "principal acknowledgment: line 1 landed; she walks to him (9.0 m), composing")).toBe(true);
  await director.tick(); // the same line is acknowledged once
  expect(channel.directions.length).toBe(1);
});

test("seated beside him, the acknowledgment keeps her seated: composing only", async () => {
  const { clock, channel, pack, director, wake } = setup();
  await pack.check();
  channel.open(clock.t, tel({ museSeated: true, distanceToGaius: 0.8 }));
  await wake({});
  channel.mail("Comfortable?", clock.t + 1);
  await director.tick();
  expect(channel.directions).toEqual([]);
  expect(channel.composing).toBe(true);
});

test("a three-beat sequence is performed at its authored delays, and his reply drops the unperformed remainder", async () => {
  const { clock, channel, pack, desk, log, speaks, wake } = setup();
  await pack.check();
  channel.open(clock.t, tel());
  const t0 = clock.t;
  const opening = await wake({
    beats: [
      { direction: { kind: "speak", text: "Do you hear the fountain?" } },
      { direction: { kind: "speak", text: "It keeps the same time as you." }, delayS: 4, when: { noReply: true } },
      { direction: { kind: "speak", text: "I counted once." }, delayS: 5, when: { noReply: true } },
    ],
  });
  expect(speaks()).toEqual(["Do you hear the fountain?"]);
  clock.t = t0 + 3900;
  await desk.pump();
  expect(speaks().length).toBe(1); // not before its time
  clock.t = t0 + 4000;
  await desk.pump();
  expect(speaks()).toEqual(["Do you hear the fountain?", "It keeps the same time as you."]);
  clock.t = t0 + 6000;
  channel.mail("I hear it.", clock.t);
  clock.t = t0 + 9000;
  await desk.pump();
  expect(speaks().length).toBe(2); // the third beat was not performed
  expect(log.filter((l) => l.startsWith("principal beat"))).toEqual([
    'principal beat 1/3 performed (condition: none): {"kind":"speak","text":"Do you hear the fountain?","lineId":"P1000000-1"}',
    'principal beat 2/3 performed (condition: no reply since the sequence began): {"kind":"speak","text":"It keeps the same time as you.","lineId":"P1000000-2"}',
    "principal beat 3/3 dropped: he replied (line 1)",
  ]);
  const slate = await wake({});
  expect(slate.sequence).toBeNull();
  const told = (s: PrincipalSlate) => s.reports.map((r) => `${r.kind}${"beat" in r ? ` ${r.beat}` : ""}`);
  expect(told(opening)).toEqual(["claim", "performed 1"]); // each report is handed over once
  expect(told(slate)).toEqual(["performed 2", "dropped 3"]);
});

test("the director's poll drops the remainder as soon as he replies, without waiting for the next beat", async () => {
  const { clock, channel, pack, director, log, speaks, wake } = setup();
  await pack.check();
  channel.open(clock.t, tel());
  await wake({ beats: [{ direction: { kind: "speak", text: "One." } }, { direction: { kind: "speak", text: "Two." }, delayS: 30 }] });
  clock.t += 2000;
  channel.mail("Wait.", clock.t);
  await director.tick();
  expect(log).toContain("principal beat 2/2 dropped: he replied (line 1)");
  clock.t += 40_000;
  await director.tick();
  expect(speaks()).toEqual(["One."]);
});

test("a new call supersedes the unperformed remainder; a finished sequence leaves her silent", async () => {
  const { clock, channel, pack, desk, log, speaks, wake } = setup();
  await pack.check();
  channel.open(clock.t, tel());
  await wake({ beats: [{ direction: { kind: "speak", text: "First." } }, { direction: { kind: "speak", text: "Later." }, delayS: 20 }] });
  clock.t += 5000;
  await wake({ direction: { kind: "speak", text: "Instead." } });
  expect(log).toContain("principal beat 2/2 dropped: superseded by her next call");
  clock.t += 60_000;
  await desk.pump();
  expect(speaks()).toEqual(["First.", "Instead."]);
});

test("conditions: a scene condition gates its beat; a material scene change drops the rest; roaming is not material", async () => {
  expect(sceneChangedMaterially("tree", "roaming")).toBe(false);
  expect(sceneChangedMaterially("tree", "forum")).toBe(true);
  expect(sceneChangedMaterially("tree", "away")).toBe(true);
  const { clock, channel, pack, desk, log, speaks, wake } = setup();
  await pack.check();
  channel.open(clock.t, tel({ gaiusZone: "tree" }));
  await wake({
    beats: [
      { direction: { kind: "speak", text: "At the lake, then." }, when: { scene: "lakeshore" } },
      { direction: { kind: "speak", text: "Here by the tree." }, delayS: 2, when: { scene: "tree" } },
      { direction: { kind: "emote", emote: "wave" }, delayS: 2 },
    ],
  });
  clock.t += 2000;
  await desk.pump();
  expect(speaks()).toEqual(["Here by the tree."]);
  expect(log).toContain("principal beat 1/3 skipped: scene condition not met (tree)");
  // He walks off to the forum before the wave.
  channel.open(clock.t - 2000, tel({ gaiusZone: "forum" }));
  clock.t += 2000;
  await desk.pump();
  expect(log.some((l) => l.startsWith("principal beat 3/3 dropped:"))).toBe(true);
});

test("refusals come back on her next slate with their reasons: the filter, the town, a bad shape", async () => {
  const { clock, channel, pack, speaks, wake } = setup();
  await pack.check();
  channel.open(clock.t, tel());
  let slate = await wake({
    beats: [
      { direction: { kind: "speak", text: "Come here and kiss me." } },
      { direction: { kind: "fly" } },
      { direction: { kind: "speak", text: "Well — never mind." } },
    ],
  });
  expect(speaks()).toEqual(["Well, never mind."]);
  const refusals = slate.reports.filter((r) => r.kind === "refused");
  expect(refusals.map((r) => r.beat)).toEqual([1, 2]);
  expect(refusals[0]!.kind === "refused" && refusals[0]!.reason.startsWith("the constitution's filter:")).toBe(true);
  expect(refusals[1]!.kind === "refused" && refusals[1]!.reason).toBe("unknown direction kind: fly");
  const performed = slate.reports.find((r) => r.kind === "performed");
  expect(performed && performed.kind === "performed" && performed.altered).toBeDefined();
  channel.close();
  clock.t += 1000;
  slate = await wake({ direction: { kind: "emote", emote: "wave" } });
  expect(slate.visit.active).toBe(false);
  expect(slate.reports.some((r) => r.kind === "dropped" || r.kind === "refused")).toBe(true);
});

test("the waiting marker says only that a line waits, its number and time, and the composing flag", async () => {
  const { clock, channel, pack, desk, director, wake } = setup();
  await pack.check();
  channel.open(clock.t, tel());
  await wake({});
  expect(desk.marker()).toEqual({ waiting: false, seq: null, at: null, composing: false, claimLive: true });
  channel.mail("Still thinking?", clock.t + 500);
  await director.tick();
  expect(desk.marker()).toEqual({ waiting: true, seq: 1, at: clock.t + 500, composing: true, claimLive: true });
  expect(JSON.stringify(desk.marker())).not.toContain("thinking");
});

test("call shapes are checked before anything is done", () => {
  expect(parsePrincipalCall({ direction: { kind: "look" }, beats: [] }).ok).toBe(false);
  expect(parsePrincipalCall({ beats: new Array(7).fill({ direction: { kind: "look" } }) }).ok).toBe(false);
  expect(parsePrincipalCall({ beats: [{ direction: { kind: "look" }, delayS: 500 }] }).ok).toBe(false);
  expect(parsePrincipalCall({ beats: [{ direction: { kind: "look" }, when: { always: true } }] }).ok).toBe(false);
  expect(parsePrincipalCall(null)).toEqual({ ok: true, call: {} });
});

test("the server answers only to her token; the marker token reads the marker and nothing else; a rotated token refuses the old", async () => {
  const { clock, channel, pack, desk } = setup();
  await pack.check();
  channel.open(clock.t, tel());
  const lines: string[] = [];
  const first = await startPrincipalServer({ desk, token: "first-principal-token", markerToken: "lesser-marker-token", port: 0, host: "127.0.0.1", log: (l) => lines.push(l) });
  const at = (port: number, path: string) => `http://127.0.0.1:${port}${path}`;
  const bearer = (t: string) => ({ authorization: `Bearer ${t}`, "content-type": "application/json" });
  expect((await (await fetch(at(first.port, "/healthz"))).json()).ok).toBe(true);
  expect((await fetch(at(first.port, "/principal/wake"), { method: "POST", body: "{}" })).status).toBe(401);
  expect((await fetch(at(first.port, "/principal/wake"), { method: "POST", headers: bearer("lesser-marker-token"), body: "{}" })).status).toBe(401);
  expect((await fetch(at(first.port, "/principal/waiting"), { headers: bearer("lesser-marker-token") })).status).toBe(200);
  const ok = await fetch(at(first.port, "/principal/wake"), { method: "POST", headers: bearer("first-principal-token"), body: "{}" });
  expect(ok.status).toBe(200);
  expect(((await ok.json()) as PrincipalSlate).claim.live).toBe(true);
  expect((await fetch(at(first.port, "/principal/wake"), { method: "POST", headers: bearer("first-principal-token"), body: "{not json" })).status).toBe(400);
  await first.close();
  // Rotation: the service restarts with the new variable.
  const second = await startPrincipalServer({ desk, token: "second-principal-token", port: 0, host: "127.0.0.1", log: (l) => lines.push(l) });
  expect((await fetch(at(second.port, "/principal/wake"), { method: "POST", headers: bearer("first-principal-token"), body: "{}" })).status).toBe(401);
  expect((await fetch(at(second.port, "/principal/wake"), { method: "POST", headers: bearer("second-principal-token"), body: "{}" })).status).toBe(200);
  await second.close();
  expect(lines.join("\n")).not.toContain("principal-token");
  expect(lines.join("\n")).not.toContain("marker-token");
});

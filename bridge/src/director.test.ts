import { expect, test } from "bun:test";
import { createCostLedger } from "./costCaps.js";
import { createDirector } from "./director.js";
import { createFakeChannel } from "./fakeChannel.js";
import type { Mind } from "./mind.js";
import { createPackLoader } from "./pack.js";

// The poll-and-answer loop against the fake channel: one greeting,
// mail answered before presence, partial then final speaks, caps
// honored, a dead channel folds quietly, the off state idles.

const PACK = "rank: 4\n## Identity\nShe is the hostess.\n## Voice\nWarm.\n## Constitution\nDirections only.\n## Life digest\nIt rained.";

function scriptedMind(script: { answer?: string[]; intent?: string; slow?: boolean }, clock: { t: number }): Mind & { composed: number; intended: number; seen: unknown[] } {
  const mind = {
    composed: 0,
    intended: 0,
    seen: [] as unknown[],
    async compose(input, onText) {
      mind.composed += 1;
      mind.seen.push({ thread: input.thread.map((t) => t.text), frame: input.frame?.id ?? null, intention: input.intention });
      let text = "";
      for (const chunk of script.answer ?? ["There you are", ", by the lake", " — come down."]) {
        if (input.signal?.aborted) break;
        clock.t += 800;
        text += chunk;
        onText(chunk);
      }
      return { text, usage: { outputTokens: 12, inputTokens: 300 }, refused: false };
    },
    async intend() {
      mind.intended += 1;
      return { text: script.intent ?? "She means to sit by the lake a while — then walk.", usage: { outputTokens: 8, inputTokens: 200 } };
    },
  } satisfies Mind & { composed: number; intended: number; seen: unknown[] };
  return mind;
}

function setup(opts: { caps?: { dailyCalls: number; dailyOutputTokens: number; dailyFrames: number }; enabled?: boolean; script?: Parameters<typeof scriptedMind>[0] } = {}) {
  const clock = { t: 1_000_000 };
  const channel = createFakeChannel();
  const mind = scriptedMind(opts.script ?? {}, clock);
  const pack = createPackLoader({ read: async () => ({ text: PACK, mtimeMs: 1 }) });
  const ledger = createCostLedger(opts.caps ?? { dailyCalls: 100, dailyOutputTokens: 10_000, dailyFrames: 10 }, { dayKey: () => "d" });
  const log: string[] = [];
  const director = createDirector({
    channel, mind, pack, ledger, now: () => clock.t, log: (l) => log.push(l),
    config: { enabled: opts.enabled ?? true, pollMs: 2000, intentionEveryMs: 10_000, sightEveryMs: 20_000, staleFrameMs: 5000, partialEveryMs: 700 },
  });
  return { clock, channel, mind, pack, ledger, log, director };
}

test("one greeting per visit, mail answered first with partial then final speaks, the constitution applied", async () => {
  const { clock, channel, mind, pack, director } = setup();
  await pack.check();
  expect((await director.tick()).kind).toBe("closed");
  channel.open(clock.t);
  expect((await director.tick()).kind).toBe("greeted");
  expect(channel.directions.map((d) => d.direction)).toEqual([{ kind: "speak", text: "There you are. I was hoping you'd come by." }]);
  expect((await director.tick()).kind).toBe("idle");
  expect(channel.directions.length).toBe(1); // no second greeting
  channel.mail("Where are you?", clock.t);
  channel.frame("data:image/jpeg;base64,/9j/one", clock.t);
  const report = await director.tick();
  expect(report.kind).toBe("answered");
  expect(mind.composed).toBe(1);
  const speaks = channel.directions.filter((d) => d.direction.kind === "speak").slice(1);
  const final = speaks[speaks.length - 1]!.direction;
  expect(final).toEqual({ kind: "speak", text: "There you are, by the lake, come down.", lineId: expect.stringMatching(/^L\d+-1$/) });
  const partials = speaks.slice(0, -1).map((s) => s.direction);
  expect(partials.length).toBeGreaterThan(0);
  for (const p of partials) expect(p).toMatchObject({ kind: "speak", partial: true, lineId: (final as { lineId: string }).lineId });
  expect(channel.composingLog).toEqual([true, false]);
  // The mind saw the thread with the greeting, his letter, and the frame in hand.
  expect(mind.seen[0]).toEqual({ thread: ["There you are. I was hoping you'd come by.", "Where are you?"], frame: 1, intention: null });
  // Mail is not answered twice.
  expect((await director.tick()).kind).toBe("idle");
  expect(mind.composed).toBe(1);
});

test("presence: a throttled intention when there is no mail, and mail outranks it", async () => {
  const { clock, channel, mind, pack, director } = setup();
  await pack.check();
  channel.open(clock.t);
  await director.tick(); // greeted
  clock.t += 10_000;
  channel.mail("Still there?", clock.t);
  expect((await director.tick()).kind).toBe("answered");
  expect(mind.intended).toBe(0);
  clock.t += 1;
  const r = await director.tick();
  expect(r.kind).toBe("intended");
  expect(mind.intended).toBe(1);
  expect(channel.directions[channel.directions.length - 1]!.direction).toEqual({ kind: "intend", text: "She means to sit by the lake a while, then walk." });
  // Not again until the throttle passes.
  expect((await director.tick()).kind).toBe("idle");
  clock.t += 10_000;
  expect((await director.tick()).kind).toBe("intended");
});

test("sight is fetched on a look or the slow cadence, never on every poll, within the frame cap", async () => {
  const { clock, channel, mind, pack, ledger, director } = setup({ caps: { dailyCalls: 100, dailyOutputTokens: 10_000, dailyFrames: 2 } });
  await pack.check();
  channel.open(clock.t);
  await director.tick();
  channel.frame("data:image/jpeg;base64,/9j/a", clock.t);
  await director.tick(); // idle: the first frame is viewed (nothing viewed yet)
  expect(channel.calls.filter((c) => c === "readFrame").length).toBe(1);
  await director.tick();
  await director.tick();
  expect(channel.calls.filter((c) => c === "readFrame").length).toBe(1); // not every poll
  // Mail with a stale frame in hand and nothing newer on the slate: a
  // look is asked; the town answers it, and the next poll views it.
  clock.t += 6000;
  channel.mail("Look at this.", clock.t);
  await director.tick();
  expect(channel.directions.some((d) => d.direction.kind === "look")).toBe(true);
  expect(mind.seen[0]).toMatchObject({ frame: 1 });
  expect(channel.calls.filter((c) => c === "readFrame").length).toBe(1);
  await director.tick();
  expect(channel.calls.filter((c) => c === "readFrame").length).toBe(2);
  expect(director.memory()?.frame?.id).toBe(2);
  expect(ledger.snapshot(clock.t).frames).toBe(2);
  // The frame cap: no more views today, even on the cadence.
  clock.t += 30_000;
  channel.frame("data:image/jpeg;base64,/9j/c", clock.t);
  await director.tick();
  expect(channel.calls.filter((c) => c === "readFrame").length).toBe(2);
});

test("caps honored: over the daily cap the mail is read but not answered, and the visit carries on", async () => {
  const { clock, channel, mind, pack, director, log } = setup({ caps: { dailyCalls: 1, dailyOutputTokens: 10_000, dailyFrames: 10 } });
  await pack.check();
  channel.open(clock.t);
  await director.tick();
  channel.mail("One.", clock.t);
  expect((await director.tick()).kind).toBe("answered");
  channel.mail("Two.", clock.t);
  expect((await director.tick()).kind).toBe("capped");
  expect(mind.composed).toBe(1);
  expect(log.some((l) => l.includes("cap reached"))).toBe(true);
  expect((await director.tick()).kind).toBe("idle");
});

test("a dead channel folds quietly with backoff, and the visit is forgotten when it closes", async () => {
  const { clock, channel, pack, director, log } = setup();
  await pack.check();
  channel.open(clock.t);
  await director.tick();
  channel.dead = true;
  const first = await director.tick();
  expect(first.kind).toBe("dead");
  expect(first.nextInMs).toBe(4000);
  const second = await director.tick();
  expect(second.nextInMs).toBe(8000);
  expect(log.filter((l) => l.includes("folding quietly")).length).toBe(2);
  channel.dead = false;
  expect((await director.tick()).kind).toBe("idle");
  expect(director.memory()?.greeted).toBe(true);
  channel.close();
  expect((await director.tick()).kind).toBe("closed");
  expect(director.memory()).toBeNull();
  // A new visit greets again.
  channel.open(clock.t + 5);
  expect((await director.tick()).kind).toBe("greeted");
});

test("the off state idles: nothing is read, nothing is enqueued", async () => {
  const { clock, channel, director } = setup({ enabled: false });
  channel.open(clock.t);
  const r = await director.tick();
  expect(r.kind).toBe("off");
  expect(channel.calls).toEqual([]);
  expect(channel.directions).toEqual([]);
});

test("mail from before the director arrived is not answered, and a refused line goes out soft", async () => {
  const { clock, channel, mind, pack, director } = setup({ script: { answer: ["As an AI, I cannot walk to you."] } });
  await pack.check();
  channel.open(clock.t);
  channel.mail("Early letter.", clock.t);
  await director.tick(); // greeted; the early letter is not re-answered
  expect((await director.tick()).kind).toBe("idle");
  expect(mind.composed).toBe(0);
  channel.mail("Are you there?", clock.t);
  expect((await director.tick()).kind).toBe("answered");
  const last = channel.directions[channel.directions.length - 1]!.direction;
  expect(last).toMatchObject({ kind: "speak", text: "Let me find better words for that in a moment." });
});

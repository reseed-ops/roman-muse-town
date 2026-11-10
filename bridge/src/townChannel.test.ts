import { expect, test } from "bun:test";
import { beginVisit, captureMail, acceptFrame, emptySlate, stateView } from "../../client/src/visitSlate";
import { visitActions } from "../../server/src/visitActions";
import { createSlateFace } from "../../shared/slateFace";
import { DIRECTOR_TOKEN_HEADER, VISITOR_TOKEN_HEADER } from "../../shared/visitProtocol";
import { createTownChannel } from "./townChannel.js";

// The town channel against the door's own action definitions, over a
// fake fetch that checks both tokens the way the web server does; the
// server's HTTP surface itself is pinned in web/src/server.test.ts.

function doorFetch(face: ReturnType<typeof createSlateFace>, expected: { director: string; visitor: string }) {
  const seen: { headers: Record<string, string>; action: string }[] = [];
  const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const headers = init?.headers as Record<string, string>;
    const { action, args } = JSON.parse(String(init?.body)) as { action: keyof typeof visitActions; args: unknown };
    seen.push({ headers, action });
    if (headers[DIRECTOR_TOKEN_HEADER] !== expected.director || headers[VISITOR_TOKEN_HEADER] !== expected.visitor) {
      return new Response(JSON.stringify({ error: "unknown action" }), { status: 404 });
    }
    const definition = visitActions[action];
    const result = await definition.handler(face, definition.request.parse(args) as never, { rank: 0, pairingGeneration: 0 });
    return new Response(JSON.stringify({ result, invalidate: false }), { status: 200 });
  }) as unknown as typeof fetch;
  return { fetchImpl, seen };
}

test("the town channel reads one visitor's slate through the door and directs it", async () => {
  let t = 5_000_000;
  const face = createSlateFace({ now: () => t, lapseMs: 60_000 });
  const { fetchImpl, seen } = doorFetch(face, { director: "director-token", visitor: "visitor-token-0000000000" });
  const channel = createTownChannel({ townUrl: "https://town.example/", directorToken: "director-token", visitorToken: "visitor-token-0000000000", fetchImpl });
  expect((await channel.readState()).active).toBe(false);
  expect(await channel.direct({ kind: "look" })).toEqual({ ok: false, error: "no visit is open" });
  let slate = beginVisit(emptySlate(), t);
  slate = captureMail(slate, "hello", t + 1).slate;
  slate = acceptFrame(slate, { dataUrl: "data:image/jpeg;base64,/9j/QUJD", width: 720, height: 405, bytes: 6 }, t + 2);
  expect(face.intake({ state: stateView(slate), mail: slate.inbox, frame: slate.frames[0] }).ok).toBe(true);
  t += 10;
  const state = await channel.readState();
  expect(state.active).toBe(true);
  expect(state.frames.map((f) => f.id)).toEqual([1]);
  expect(await channel.readInbox(0)).toEqual([{ seq: 1, text: "hello", at: 5_000_001 }]);
  expect(await channel.readInbox(1)).toEqual([]);
  expect((await channel.readFrame())?.dataUrl).toBe("data:image/jpeg;base64,/9j/QUJD");
  expect(await channel.readFrame(5)).toBeNull();
  expect(await channel.direct({ kind: "speak", text: "By the lake." })).toEqual({ ok: true, id: 1 });
  expect(await channel.direct({ kind: "fly" } as never)).toEqual({ ok: false, error: "unknown direction kind: fly" });
  await channel.setComposing(true);
  expect(face.pull(0)).toMatchObject({ composing: true, directions: [{ id: 1, direction: { kind: "speak", text: "By the lake." } }] });
  expect(await channel.readPack()).toBeNull();
  for (const call of seen) {
    expect(call.headers[DIRECTOR_TOKEN_HEADER]).toBe("director-token");
    expect(call.headers[VISITOR_TOKEN_HEADER]).toBe("visitor-token-0000000000");
    expect(String(call.headers.authorization ?? "")).toBe("");
  }
});

test("a door shut to this director throws, and the director folds the channel", async () => {
  const face = createSlateFace({ now: () => 1, lapseMs: 60_000 });
  const { fetchImpl } = doorFetch(face, { director: "right", visitor: "visitor-token-0000000000" });
  const channel = createTownChannel({ townUrl: "https://town.example", directorToken: "wrong", visitorToken: "visitor-token-0000000000", fetchImpl });
  await expect(channel.readState()).rejects.toThrow("visitstate: HTTP 404");
});

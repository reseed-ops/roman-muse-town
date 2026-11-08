import { expect, test } from "bun:test";
import { HOSTED_BRIDGE_URL, museConnectMessage, requestPairCode } from "./connectMuse";

// Task 29: the town side of Connect my Muse.

test("the message carries the code, the bridge and the repo, and never the visitor key", () => {
  const text = museConnectMessage("ABCDE-FGH23");
  expect(text).toContain('{"code":"ABCDE-FGH23"}');
  expect(text).toContain(`${HOSTED_BRIDGE_URL}/pair`);
  expect(text).toContain("bridge/README.md");
  expect(text).toContain("never write it in our chat");
  expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
});

test("the code is asked of the town's own origin with the visitor key as the bearer", async () => {
  const seen: { url: string; auth: string | null }[] = [];
  const fake = (async (url: string, init?: RequestInit) => {
    seen.push({ url, auth: new Headers(init?.headers).get("authorization") });
    return new Response(JSON.stringify({ code: "ABCDE-FGH23", expiresAt: 123 }), { status: 200 });
  }) as unknown as typeof fetch;
  const got = await requestPairCode("https://town.test", () => "visitor-key-0000000000001", fake);
  expect(got).toEqual({ code: "ABCDE-FGH23", expiresAt: 123 });
  expect(seen).toEqual([{ url: "https://town.test/bridge/pair", auth: "Bearer visitor-key-0000000000001" }]);
  const refused = (async () => new Response("{}", { status: 401 })) as unknown as typeof fetch;
  await expect(requestPairCode("https://town.test", () => "k", refused)).rejects.toThrow("HTTP 401");
});

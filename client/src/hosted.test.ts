import { expect, test } from "bun:test";
import { HOSTED_META_NAME } from "../../shared/visitProtocol";
import { isHostedTown, VISITOR_TOKEN_STORAGE_KEY, visitorToken } from "./hosted";
import { hostedBridgeSettings, resolveBridge } from "./visitBridgeClient";

// The hosted town (Task 8): one meta tag is the whole signal; off the
// web nothing branches. The visitor token is minted once and kept.

const doc = (hosted: boolean) => ({ querySelector: (selector: string) => (hosted && selector === `meta[name="${HOSTED_META_NAME}"]` ? {} : null) });

test("hosted is one meta tag, and absent everywhere else", () => {
  expect(isHostedTown(doc(true))).toBe(true);
  expect(isHostedTown(doc(false))).toBe(false);
  expect(isHostedTown(undefined)).toBe(false);
});

test("the visitor token is minted once, kept, and a malformed stored one is replaced", () => {
  const store = new Map<string, string>();
  const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
  const first = visitorToken(storage);
  expect(first).toMatch(/^[0-9a-f-]{36}$/);
  expect(store.get(VISITOR_TOKEN_STORAGE_KEY)).toBe(first);
  expect(visitorToken(storage)).toBe(first);
  store.set(VISITOR_TOKEN_STORAGE_KEY, "nope; drop");
  const replaced = visitorToken(storage);
  expect(replaced).not.toBe("nope; drop");
  expect(store.get(VISITOR_TOKEN_STORAGE_KEY)).toBe(replaced);
});

test("the hosted town's door is the default bridge, an entered bridge wins, and off the web there is none", () => {
  const token = () => "visitor-token-0000000000";
  expect(hostedBridgeSettings(false, "https://town.example", token)).toBeNull();
  expect(hostedBridgeSettings(true, "", token)).toBeNull();
  const hosted = hostedBridgeSettings(true, "https://town.example/", token);
  expect(hosted).toEqual({ url: "https://town.example", token: "visitor-token-0000000000" });
  expect(resolveBridge({ url: "", token: "" }, hosted)).toEqual(hosted);
  expect(resolveBridge({ url: "https://bridge.example", token: "t" }, hosted)).toEqual({ url: "https://bridge.example", token: "t" });
  expect(resolveBridge({ url: "", token: "" }, null)).toBeNull();
});

// Task 74: the caller wiring, mounted. The helper tests in connectMuse.test.ts
// drive the functions directly; this one mounts the real useConnectMuse hook
// (in happy-dom) with the real menu item, and clicks it. It fails if the hook
// stops calling startPairingCheck, stops rerunning it on retry, loses its
// cleanup, or if App stops calling the hook or inserting the item.
import { afterAll, beforeAll, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { act, createElement } from "react";
import { HOSTED_META_NAME } from "../../shared/visitProtocol";

const realFetch = globalThis.fetch;
const realSetTimeout = globalThis.setTimeout;
let calls: Array<(r: Response) => void> = [];

beforeAll(() => {
  GlobalRegistrator.register();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  document.head.innerHTML = `<meta name="${HOSTED_META_NAME}" content="1">`;
  // The backoff pauses (2/5/10 s) run at once; each fetch waits for the test to answer it.
  globalThis.setTimeout = ((fn: () => void, _ms?: number) => realSetTimeout(fn, 0)) as typeof setTimeout;
  globalThis.fetch = (() => new Promise<Response>((resolve) => calls.push(resolve))) as unknown as typeof fetch;
});
afterAll(async () => {
  globalThis.fetch = realFetch;
  globalThis.setTimeout = realSetTimeout;
  await GlobalRegistrator.unregister();
});

const settle = () => act(async () => { for (let i = 0; i < 20; i++) await new Promise((r) => realSetTimeout(r, 0)); });
const answer = async (status: number, body: unknown = {}) => {
  const resolve = calls.shift()!;
  resolve(new Response(JSON.stringify(body), { status }));
  await settle();
};

test("mounted hook and menu item: checking, unavailable, tap to retry, live; unmount cancels", async () => {
  const { createRoot } = await import("react-dom/client");
  const { useConnectMuse } = await import("./ConnectMusePanel");
  const { connectMuseMenuItem } = await import("./connectMuse");
  function Menu() {
    const { pairing, retryPairing, openConnectMuse, connectMuse } = useConnectMuse(() => {});
    const item = connectMuseMenuItem(pairing, { openConnectMuse, retryPairing }, connectMuse !== null);
    return item ? createElement("button", { id: "row", "aria-label": item.aria, onClick: item.action }, item.detail) : createElement("i", { id: "none" });
  }
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const row = () => host.querySelector("#row")?.textContent;

  await act(async () => root.render(createElement(Menu)));
  expect(row()).toContain("Checking");
  expect(calls.length).toBe(1);

  for (let i = 0; i < 4; i++) await answer(503);
  expect(row()).toContain("Could not check whether pairing is ready");
  expect(calls.length).toBe(0);

  await act(async () => (host.querySelector("#row") as HTMLElement).click());
  expect(row()).toContain("Checking");
  expect(calls.length).toBe(1);
  await answer(200, { pairing: true });
  expect(row()).toContain("one-time code");

  await act(async () => root.unmount());
  const root2 = createRoot(host);
  await act(async () => root2.render(createElement(Menu)));
  expect(calls.length).toBe(1);
  await act(async () => root2.unmount());
  await answer(503);
  expect(calls.length).toBe(0);
});

test("App calls the hook and puts the item in the menu", () => {
  const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
  expect(app).toMatch(/useConnectMuse\(/);
  expect(app).toMatch(/connectMuseMenuItem\(/);
  expect(app).toContain("...(connectMuseItem ? [connectMuseItem] : [])");
});

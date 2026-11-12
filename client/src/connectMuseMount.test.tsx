// Tasks 74-75: the caller wiring, mounted. This mounts ConnectMuseMenu, the
// production component App renders for the town menu (it owns the hook, the
// panel, and the row's insertion), with the REAL TownMenu, in happy-dom, and
// clicks the real rendered row. It fails if the hook stops checking or
// retrying, the item is mis-built, the group insertion is discarded, or the
// TownMenu stops calling an item's action. App's own part is only to render
// the component with its groups (a second test below).
import { afterAll, beforeAll, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { act, createElement } from "react";
import { HOSTED_META_NAME } from "../../shared/visitProtocol";

const realFetch = globalThis.fetch;
const realSetTimeout = globalThis.setTimeout;
const realAct = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
let host: HTMLElement;
const freshHost = () => { host?.remove(); host = document.createElement("div"); document.body.append(host); };
let calls: Array<(r: Response) => void> = [];

beforeAll(() => {
  GlobalRegistrator.register();
  freshHost();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  document.head.innerHTML = `<meta name="${HOSTED_META_NAME}" content="1">`;
  // The backoff pauses (2/5/10 s) run at once; each fetch waits for the test to answer it.
  globalThis.setTimeout = ((fn: () => void, _ms?: number) => realSetTimeout(fn, 0)) as typeof setTimeout;
  globalThis.fetch = (() => new Promise<Response>((resolve) => calls.push(resolve))) as unknown as typeof fetch;
});
afterAll(async () => {
  host.remove();
  if (realAct === undefined) delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  else (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = realAct;
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

const noop = () => {};
test("mounted ConnectMuseMenu with the real TownMenu: checking, unavailable, tap to retry, live opens the panel; unmount cancels", async () => {
  const { createRoot } = await import("react-dom/client");
  const { ConnectMuseMenu } = await import("./ConnectMusePanel");
  freshHost();
  let visitClicks = 0;
  let closes = 0;
  const App = () => createElement(ConnectMuseMenu, {
    menuOpen: true, closeMenu: () => { closes++; }, rowGroup: "Muse's visit", className: "m",
    onSettings: noop,
    groups: [
      { heading: "Aelia", items: [] },
      { heading: "Muse's visit", items: [{ key: "visit", icon: "✦", label: "Talk to my Muse", active: false, action: () => { visitClicks++; }, aria: "visit" }] },
    ],
  });
  const section = () => host.querySelector('section[aria-label="Muse\'s visit"]');
  const row = () => section()?.querySelector('button[aria-label^="Connect my Muse"]') as HTMLElement | null;
  const root = createRoot(host);

  await act(async () => root.render(createElement(App)));
  expect(row()?.textContent).toContain("Checking");
  expect(row()?.getAttribute("aria-label")).toContain("checking");
  expect(section()?.querySelectorAll("button").length).toBe(2); // the visit row is kept, the item is appended
  expect(calls.length).toBe(1);
  await act(async () => row()!.click()); // checking does nothing
  expect(calls.length).toBe(1);

  for (let i = 0; i < 4; i++) await answer(503);
  expect(row()?.textContent).toContain("Could not check whether pairing is ready");
  expect(calls.length).toBe(0);

  await act(async () => row()!.click());
  expect(closes).toBe(2); // each tap closes the menu (checking tap + this one), then calls the action
  expect(row()?.textContent).toContain("Checking");
  expect(calls.length).toBe(1);
  await answer(200, { pairing: true });
  expect(row()?.textContent).toContain("one-time code");
  expect(host.querySelector('section[aria-label="Connect my Muse"]')).toBeNull();

  await act(async () => row()!.click()); // live opens the panel (and asks for a code)
  expect(host.querySelector('section[aria-label="Connect my Muse"]')).not.toBeNull();
  calls.shift(); // the pair-code request
  expect(visitClicks).toBe(0);
  await act(async () => (section()!.querySelector('button[aria-label="visit"]') as HTMLElement).click());
  expect(visitClicks).toBe(1);

  await act(async () => root.unmount());
  const root2 = createRoot(host);
  await act(async () => root2.render(createElement(App)));
  expect(calls.length).toBe(1);
  await act(async () => root2.unmount());
  await answer(503);
  expect(calls.length).toBe(0);
});

test("a closed menu draws no row but the hook still runs; an unpaired town draws none", async () => {
  const { createRoot } = await import("react-dom/client");
  const { ConnectMuseMenu } = await import("./ConnectMusePanel");
  freshHost();
  const root = createRoot(host);
  await act(async () => root.render(createElement(ConnectMuseMenu, { menuOpen: false, closeMenu: noop, rowGroup: "x", className: "m", onSettings: noop, groups: [] })));
  expect(host.querySelector("nav")).toBeNull();
  expect(calls.length).toBe(1);
  await act(async () => root.unmount());
  await answer(503);
  freshHost();
  const root2 = createRoot(host);
  await act(async () => root2.render(createElement(ConnectMuseMenu, { menuOpen: true, closeMenu: noop, rowGroup: "x", className: "m", onSettings: noop, groups: [] })));
  await answer(200, { pairing: false });
  expect(host.querySelector('button[aria-label^="Connect my Muse"]')).toBeNull();
  await act(async () => root2.unmount());
});

test("App renders the production ConnectMuseMenu for the town menu and no second TownMenu", () => {
  const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
  expect(app).toMatch(/<ConnectMuseMenu[\s\S]*?rowGroup="Muse's visit"/);
  expect(app).toMatch(/closeMenu=\{closeMenu\}/);
  expect(app).not.toMatch(/<TownMenu/);
  expect(app).not.toMatch(/useConnectMuse\(/);
});

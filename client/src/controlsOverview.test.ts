import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The overview-controls audit (owner ask, Nov 1, refining the v36
// camera fix; owner prescription, Nov 2, moving the overview off B
// and into the town menu). The scene cannot load here (it needs a
// GPU), so these tests read App.tsx the way townAudit reads
// townScene.ts: they pin the exact wiring that keeps the overview
// from becoming a one-way door again, and B from ever toggling it.
// If a marker below moves, the test fails loudly rather than
// passing on nothing.

const app = readFileSync(join(import.meta.dir, "App.tsx"), "utf8").replace(/\r\n/g, "\n");

function slice(from: string, to: string): string {
  const start = app.indexOf(from);
  const end = app.indexOf(to, start);
  if (start < 0 || end < 0) throw new Error(`audit marker moved: ${from} .. ${to}`);
  return app.slice(start, end);
}

const xboxBack = slice("const xboxBack = () => {", "const xboxHint = () => {");

test("the on-screen camera toggle button is gone", () => {
  // The v36 bottom-centre buttons, in both modes and both of their
  // wordings, no longer exist anywhere in the app.
  expect(app).not.toContain('aria-label="Town overview, see the whole town from above"');
  expect(app).not.toContain("Back to Gaius · third-person view");
  expect(app).not.toContain('<span aria-hidden="true">🗺</span> Town overview');
  expect(app).not.toContain('<span aria-hidden="true">🚶</span> Back to Gaius');
});

test("B never toggles the overview, in either direction", () => {
  // Owner prescription, Nov 2: the overview left B entirely.
  // xboxBack's chain now ends at the slide branch; standing
  // still, B does nothing, so a refused slide can no longer
  // turn the press into a camera move (the failure that kept
  // sending running players into the overview).
  expect(xboxBack).not.toContain("exitWalkMode");
  expect(xboxBack).not.toContain("enterWalkMode");
  expect(xboxBack).toContain("sceneRef.current?.slide()");
  // The dismiss and step-out branches keep first claim on B,
  // ahead of the slide, in the overview as in walk mode.
  expect(xboxBack.indexOf("if (museBubbleRef.current)")).toBeLessThan(
    xboxBack.indexOf("sceneRef.current?.slide()"),
  );
  expect(xboxBack.indexOf("rowingRef.current")).toBeLessThan(
    xboxBack.indexOf("sceneRef.current?.slide()"),
  );
});

test("the way back from the overview is backToGaius, not B", () => {
  // backToGaius performs the return the old B fall-through did:
  // stop the tour, put the panels away, and re-enter walk mode
  // (scene.enterWalk snaps the third-person follow camera
  // behind Gaius at the standard framing).
  const back = slice("const backToGaius = () => {", "const xboxBack = () => {");
  expect(back).toContain("stopTour();");
  expect(back).toContain("enterWalkMode();");
});

test("the overview lives in the town menu, both ways", () => {
  // The View & weather entry is the overview switch now: into
  // the overview from walk mode, back to walking from it. It
  // sits in the same menu as the day/night toggle, over the
  // motion line at the menu's foot.
  expect(app).toContain('label: walking ? "Town overview" : "Walk around town"');
  expect(app).toContain("action: walking ? goOverview : toggleWalk");
  expect(app).toContain(
    'aria: walking ? "Switch to the town overview" : "Enter walk mode, stroll the town on foot"',
  );
});

test("the ABXY cluster stays mounted while the overview is up", () => {
  // The controls fragment renders in walk mode OR the overview.
  expect(app).toContain("{(walking || overviewControlsLive) && (");
  // The overview gate is about who owns the town screen (scene
  // ready, no dream, no tour), never about walk mode ending.
  expect(app).toContain(
    "const overviewControlsLive = sceneReady && !dreaming && tourStep === null;",
  );
  // The cluster itself, with its B handler live, is inside that
  // fragment: the fragment opens before the cluster markup and the
  // cluster's B button still calls xboxBack.
  const fragmentStart = app.indexOf("{(walking || overviewControlsLive) && (");
  const clusterStart = app.indexOf('data-mt-controls="1"');
  expect(fragmentStart).toBeGreaterThan(-1);
  expect(clusterStart).toBeGreaterThan(fragmentStart);
  const cluster = app.slice(clusterStart, app.indexOf("{/* A special-occasion offer", clusterStart));
  // B fires on the press (onPointerDown, like A), the click kept
  // only as the keyboard-activation path (detail === 0): on release
  // the pressing gesture has already centred the stick, which is
  // what starved B's slide branch for four releases.
  const bButton = cluster.slice(
    cluster.indexOf('"B button, slide while moving'),
    cluster.indexOf('aria-label="A button, jump"'),
  );
  expect(bButton).toContain("onPointerDown");
  expect(bButton).toContain("xboxBack();");
  expect(bButton).toContain("if (e.detail === 0) xboxBack();");
  expect(bButton).not.toContain("onClick={xboxBack}");
  // The way back while the overview is up is a tappable chip
  // under the cluster, not a caption and not B: it calls
  // backToGaius and carries no B label, so the overview is
  // never a dead end.
  expect(cluster).toContain("onClick={backToGaius}");
  expect(cluster).toContain("Back to Gaius");
  expect(cluster).not.toContain("B · Back to Gaius");
  expect(cluster).toContain("{!walking && (");
});

test("the joystick stays walk-only while the cluster stays", () => {
  // Movement has no overview meaning: the stick is gated on
  // walking inside the same fragment that keeps the ABXY cluster.
  const fragmentStart = app.indexOf("{(walking || overviewControlsLive) && (");
  const stickGate = app.indexOf("{walking && (", fragmentStart);
  const stick = app.indexOf('data-mt-stick="1"', fragmentStart);
  const clusterStart = app.indexOf('data-mt-controls="1"', fragmentStart);
  expect(stickGate).toBeGreaterThan(fragmentStart);
  expect(stick).toBeGreaterThan(stickGate);
  expect(clusterStart).toBeGreaterThan(stick);
});

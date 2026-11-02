import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The pull-to-refresh audit. The town is a full-screen game, but in a
// webview shell a downward drag can still be read by the browser as
// pull-to-refresh and reload the town mid-play. The defence is
// layered, and every layer has been thinned or lost in some past
// edit at least once, so these tests pin each one in the sources the
// way reducedMotion and controlsOverview pin theirs. If a marker
// below moves, the test fails loudly rather than passing on nothing.
//
// The layers, outermost first:
//   1. theme.css: overscroll-behavior none on html and body, so the
//      overscroll chain that arms pull-to-refresh in Chrome and
//      Android WebView is broken at the document root.
//   2. theme.css: the body is fixed with no scrollable area, and the
//      game surface and shell roots carry touch-action none, so a
//      drag is delivered to the game as pointer events instead of
//      becoming a browser gesture candidate.
//   3. App.tsx: a document-level capture-phase non-passive touchmove
//      (and touch pointermove) preventer, because the CSS layers
//      alone do not cover every host: pulls starting on UI gaps and
//      chips can still refresh the town. It allowlists the marked
//      scrollable panels, and inside a panel it allows a scroll move
//      only while the panel has room in the drag direction, so a
//      panel edge never hands the drag to the browser either.
//   4. theme.css: those panels (.mt-scrollable) opt back into
//      vertical panning with contained overscroll, so letters, the
//      notebook and the menus keep their normal internal scrolling
//      and a panel scroll can never chain into a page refresh.
//   5. main.tsx: the page holds itself one pixel below the top, for
//      a host app's native refresh watcher, which only fires while
//      the page reports being at the very top and which no in-page
//      handler can reach.

const css = readFileSync(join(import.meta.dir, "theme.css"), "utf8").replace(/\r\n/g, "\n");
const app = readFileSync(join(import.meta.dir, "App.tsx"), "utf8").replace(/\r\n/g, "\n");
const main = readFileSync(join(import.meta.dir, "main.tsx"), "utf8").replace(/\r\n/g, "\n");

function slice(source: string, from: string, to: string): string {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start);
  if (start < 0 || end < 0) throw new Error(`audit marker moved: ${from} .. ${to}`);
  return source.slice(start, end);
}

test("the document root refuses the overscroll chain", () => {
  const root = slice(css, "html,\nbody {", "}");
  expect(root).toContain("overscroll-behavior: none;");
  expect(root).toContain("overscroll-behavior-y: none;");
});

test("the document has no scrollable area of its own", () => {
  const body = slice(css, "body {\n  position: fixed;", "}");
  expect(body).toContain("position: fixed;");
  expect(body).toContain("overflow: hidden;");
});

test("the game surface claims its touches for the game", () => {
  const surface = slice(css, ".mt-game-surface {", "}");
  expect(surface).toContain("touch-action: none;");
  expect(surface).toContain("overscroll-behavior: none;");
  const shell = slice(css, "[data-hatch-space-root] {", "}");
  expect(shell).toContain("touch-action: none;");
  // The shell's root container and canvas wear the class in App.tsx.
  expect(app).toContain("mt-game-surface fixed inset-0 touch-none overflow-hidden");
  expect(app).toContain("mt-game-surface absolute inset-0 h-full w-full touch-none");
});

test("the JS guard cancels pull moves outside the scrollable panels", () => {
  const guard = slice(app, "// Capture touch gestures before descendant handlers.", "// Keep the looping ambience");
  expect(guard).toContain("const captureTouch = { passive: false, capture: true };");
  expect(guard).toContain('document.addEventListener("touchmove", blockPullMove, captureTouch);');
  expect(guard).toContain('document.addEventListener("pointermove", blockPullPointer, captureTouch);');
  expect(guard).toContain('closest<HTMLElement>(".mt-scrollable, [data-scrollable]")');
  expect(guard).toContain('e.pointerType === "touch"');
  // Inside a panel, a downward move at the panel's top edge is still
  // refused, so the edge cannot hand the drag to the browser.
  expect(guard).toContain("(dy > 0 && panel.scrollTop <= 0)");
});

test("scrollable panels keep their own contained scrolling", () => {
  const panel = slice(css, ".mt-scrollable {", "}");
  expect(panel).toContain("overscroll-behavior: contain;");
  expect(panel).toContain("touch-action: pan-y;");
});

test("the page holds itself one pixel below the top", () => {
  expect(main).toContain("if (window.scrollY <= 0) window.scrollTo(0, 1);");
  expect(css).toContain("height: calc(100% + 1px);");
});

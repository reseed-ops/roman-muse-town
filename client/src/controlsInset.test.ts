import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Task 92: the virtual controls sit inset from the screen edges by the
// phone's safe-area inset plus a base margin, never flush.
const app = readFileSync(join(import.meta.dir, "App.tsx"), "utf8").replace(/\r\n/g, "\n");

function classesNear(marker: string): string[] {
  const out: string[] = [];
  let i = -1;
  while ((i = app.indexOf(marker, i + 1)) >= 0) out.push(app.slice(Math.max(0, i - 700), i + 200));
  return out;
}

test("joystick, ABXY, shoulders and triggers carry safe-area insets", () => {
  for (const [name, edge] of [
    ["Left joystick, drag to walk", "left"],
    ['data-mt-controls="1"', "right"],
    ['data-mt-shoulders={side}', "left"],
    ['data-mt-triggers={side}', "left"],
  ] as const) {
    const near = classesNear(name).join("\n");
    expect(near).toContain(`${edge}-[calc(env(safe-area-inset-${edge},0px)+`);
    expect(near).toContain("bottom-[calc(env(safe-area-inset-bottom,0px)+");
  }
});

test("no control wrapper is flush with an edge any more", () => {
  expect(app).not.toContain('"absolute bottom-3 left-3 z-20');
  expect(app).not.toContain('"absolute right-3 bottom-3 z-20');
  expect(app).not.toContain("absolute left-3 bottom-[168px]");
  expect(app).not.toContain("absolute right-3 bottom-[200px]");
});

import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { SIGHT_LINE, VISITING_MARKER, VISIT_ANCHOR_NAMES } from "../../shared/visitProtocol";

// Muse Visits (Task 4), the shell's side, pinned at the source (the
// repo's audit pattern): the panel hush, the presence signs, and the
// scene's anchor table.

const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
const scene = readFileSync(new URL("./townScene.ts", import.meta.url), "utf8");
const worker = readFileSync(new URL("./aeliaLocalChat.worker.ts", import.meta.url), "utf8");

const sendChat = (() => {
  const start = app.indexOf("const sendChat = useCallback(() => {");
  const end = app.indexOf("}, [chatDraft, museChatContext]);", start);
  expect(start).toBeGreaterThan(0);
  expect(end).toBeGreaterThan(start);
  return app.slice(start, end);
})();

test("a visit send is captured as mail and returns before any reply, local chat, note or fact capture", () => {
  const hush = sendChat.indexOf("if (visitRef.current.active) {");
  expect(hush).toBeGreaterThan(0);
  const hushBlock = sendChat.slice(hush, sendChat.indexOf("\n    }\n", hush));
  expect(hushBlock).toContain("captureMail(visitRef.current, msg");
  expect(hushBlock).toContain("return;");
  for (const quick of ["addNote.mutate", "learnFactRef.current", "isFlirtation(msg)", "generateLocalAeliaReply(", "scriptedMuseReply(", "chatWithMuse.mutateAsync("]) {
    const at = sendChat.indexOf(quick);
    expect(at).toBeGreaterThan(hush);
  }
  // The hush block itself touches none of them.
  for (const quick of ["addNote", "learnFact", "generateLocalAeliaReply", "scriptedMuseReply", "chatWithMuse", "api."]) {
    expect(hushBlock).not.toContain(quick);
  }
  // Outside a visit the path is unchanged: the hush is the only visit
  // check in the send, and it is a plain early return.
  // (The fourth mention is the reload record, saved inside the hush.)
  expect(sendChat.split("visitRef.current").length - 1).toBe(4);
});

test("the presence signs: the violet star stays; the talk panel during a visit is just Aelia and you (Task 28)", () => {
  expect(scene).toContain("mat.color.setHex(on ? VISIT_STAR_COLOR : 0xffd34e)");
  // The constants stay in the protocol; the panel no longer shows them.
  expect(SIGHT_LINE).toBe("Muse can see your view while visiting.");
  expect(VISITING_MARKER).toBe("Muse is visiting");
  expect(app).not.toContain("{VISITING_MARKER}");
  expect(app).not.toContain("{SIGHT_LINE}");
  for (const gone of ["carried to Muse", "Muse, as Aelia", "Lines marked Muse are hers", "Aelia's own voice, not from Muse"]) {
    expect(app).not.toContain(gone);
  }
  expect(app).toContain('{entry.who === "him" ? "You" : "Aelia"}: ');
  // Her own town voice line is not shown while a visit is open.
  const own = app.indexOf('onClick={advanceMuseBubble}');
  expect(app.lastIndexOf("{!visitUi.active && (", own)).toBeGreaterThan(own - 400);
});

test("the scene resolves every named anchor, and the local Gemma chat is not wired as a director", () => {
  for (const name of VISIT_ANCHOR_NAMES) {
    if (name === "gaius" || name === "bench") expect(scene).toContain(`anchor === "${name}"`);
    else expect(new RegExp(`^    ${name}: \\[`, "m").test(scene)).toBe(true);
  }
  // The shell's visit code never reaches the local chat, and the
  // worker never learns of visits: prompts and guards stay as they were.
  const visitCode = app.slice(app.indexOf("// --- Muse Visits (Task 4): lifecycle"), app.indexOf("}, [visitUi.active]);"));
  expect(visitCode).not.toContain("generateLocalAeliaReply");
  expect(visitCode).not.toContain("api.");
  expect(worker).not.toContain("visit");
});

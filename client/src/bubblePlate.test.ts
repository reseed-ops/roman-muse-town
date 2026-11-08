import { expect, test } from "bun:test";
import { BUBBLE_LINES_PER_PAGE, BUBBLE_SPEAKERS, bubblePageDuration, drawBubblePlate, paginateBubbleText, wrapBubbleLines } from "./bubblePlate";

// The speaker's plate, tested off the scene: a fake 2D context whose
// text is 40 px a character, so wrapping is predictable (800 px wrap =
// 20 characters, 840 px = 21).

function fakeCtx() {
  const calls: string[] = [];
  const texts: string[] = [];
  const ctx = new Proxy(
    { font: "", fillStyle: "", strokeStyle: "", lineWidth: 0, textAlign: "", textBaseline: "", shadowColor: "", shadowBlur: 0, shadowOffsetY: 0 } as Record<string, unknown>,
    {
      get(target, key: string) {
        if (key === "measureText") return (t: string) => ({ width: t.length * 40 });
        if (key === "fillText") return (t: string) => { texts.push(t); calls.push("fillText"); };
        if (key in target) return target[key];
        return () => { calls.push(key); };
      },
      set(target, key: string, value) {
        target[key] = value;
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, calls, texts };
}

test("no bubble ends on one word alone: a short last word rejoins the line above", () => {
  const { ctx } = fakeCtx();
  // "aaaa bbbb cccc dddd" is 19 chars; " e" fits under 21.
  expect(wrapBubbleLines(ctx, "aaaa bbbb cccc dddd e")).toEqual(["aaaa bbbb cccc dddd e"]);
  // Too long to rejoin: the line above lends its last word instead.
  const lines = wrapBubbleLines(ctx, "aaaa bbbb cccc ddddd eeeeeee");
  expect(lines.length).toBe(2);
  expect(lines[1]!.split(" ").length).toBeGreaterThan(1);
});

test("a long line pages in full, three lines a page, never a lone line on its last page", () => {
  const { ctx } = fakeCtx();
  const words = Array.from({ length: 28 }, (_, i) => `w${String(i).padStart(3, "0")}`).join(" ");
  const pages = paginateBubbleText(ctx, words);
  expect(pages.join(" ")).toBe(words);
  for (const page of pages) expect(wrapBubbleLines(ctx, page).length).toBeLessThanOrEqual(BUBBLE_LINES_PER_PAGE);
  expect(wrapBubbleLines(ctx, pages[pages.length - 1]!).length).toBeGreaterThan(1);
  expect(bubblePageDuration("short")).toBeGreaterThanOrEqual(3.4);
});

test("the plate draws the speaker's name, the words, and a chevron only when more follows", () => {
  const one = fakeCtx();
  drawBubblePlate(one.ctx, { pages: ["There you are."], pageIdx: 0, tailFrac: 0.5, speaker: BUBBLE_SPEAKERS.muse });
  expect(one.texts).toEqual(["✦ Aelia", "There you are."]);
  const fills = (c: string[]) => c.filter((k) => k === "fill").length;
  const more = fakeCtx();
  drawBubblePlate(more.ctx, { pages: ["First page.", "Second."], pageIdx: 0, tailFrac: 0.2, speaker: BUBBLE_SPEAKERS.player });
  expect(more.texts[0]).toBe("Gaius");
  expect(fills(more.calls)).toBe(fills(one.calls) + 1);
});

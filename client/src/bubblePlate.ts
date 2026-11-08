// The speaker's plate, drawn (Nov 8, 2026; moved out of townScene.ts):
// the text layout and canvas drawing of the 3D speech bubbles over
// Aelia's and Gaius's heads. Pure 2D canvas work, no three.js: the
// scene owns the sprite, its texture, its screen placement and timing,
// and calls drawBubblePlate whenever a page or the tail changes.

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** What drawing needs of a bubble. */
export interface BubblePlateView {
  pages: string[];
  pageIdx: number;
  /** 0..1 across the plate, where the tail points at the speaker. */
  tailFrac: number;
  speaker: BubbleSpeaker;
}

// The speaker's plate (Nov 8, 2026): every speech bubble in the
// town, over a head here or the talk panel in the shell, is one
// design: an ivory plate with a gold hairline inside its edge, the
// spoken words in the voice serif, and the speaker's name on a
// coloured tab across the plate's top-left edge, Aelia's gold with
// her star, Gaius's crest red. Tokens mirror theme.css (--bubble-*).
export interface BubbleSpeaker { name: string; color: string }
export const BUBBLE_SPEAKERS = {
  muse: { name: "✦ Aelia", color: "#b07d12" },
  player: { name: "Gaius", color: "#9a3b2a" },
} satisfies Record<string, BubbleSpeaker>;
export const BUBBLE_PLATE = "#fffaf2";
export const BUBBLE_INK = "#1d1712";
export const BUBBLE_RIM = "rgba(217,178,74,0.8)";
export const BUBBLE_VOICE_FONT = '500 68px "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, "Noto Serif", serif';
export const BUBBLE_TAB_FONT = "700 36px Quicksand, ui-rounded, sans-serif";
export const BUBBLE_LINES_PER_PAGE = 3;
/** Wrap width for a line; the orphan fix may run a little past it. */
export const BUBBLE_WRAP_W = 800;
export const BUBBLE_TEXT_MAX_W = 840;
export const BUBBLE_PAD_X = 64;
export const BUBBLE_LINE_H = 86;
export function bubblePageDuration(page: string): number {
  return clamp(3 + page.length * 0.05, 3.4, 8.5);
}
export function wrapBubbleLines(ctx: CanvasRenderingContext2D, text: string): string[] {
  ctx.font = BUBBLE_VOICE_FONT;
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const trial = line ? `${line} ${w}` : w;
    if (ctx.measureText(trial).width > BUBBLE_WRAP_W && line) {
      lines.push(line);
      line = w;
    } else {
      line = trial;
    }
  }
  if (line) lines.push(line);
  return lines.length > 0 ? fixBubbleOrphan(ctx, lines) : [""];
}
/** No bubble ends on one word alone (Task 25): a short last word
 *  rejoins the line above when it still fits inside the box, else
 *  the line above lends it its own last word. */
export function fixBubbleOrphan(ctx: CanvasRenderingContext2D, lines: string[]): string[] {
  const n = lines.length;
  if (n < 2) return lines;
  const last = lines[n - 1]!;
  if (/\s/.test(last)) return lines;
  const prev = lines[n - 2]!;
  const joined = `${prev} ${last}`;
  if (ctx.measureText(joined).width <= BUBBLE_TEXT_MAX_W) return [...lines.slice(0, n - 2), joined];
  const cut = prev.lastIndexOf(" ");
  if (cut <= 0) return lines;
  return [...lines.slice(0, n - 2), prev.slice(0, cut), `${prev.slice(cut + 1)} ${last}`];
}
/** Split a line into bubble pages: whole sentences are packed into
 *  pages of at most BUBBLE_LINES_PER_PAGE wrapped lines; a sentence
 *  too long for one page is carried over line-wrapped pages of its
 *  own. The full text survives, that is the entire point. */
export function paginateBubbleText(ctx: CanvasRenderingContext2D, text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [""];
  const sentences = clean.match(/[^.!?…]+[.!?…]+["'”’)]?\s*/g)?.map((s) => s.trim()).filter(Boolean) ?? [clean];
  const pages: string[] = [];
  let cur = "";
  const fits = (s: string) => wrapBubbleLines(ctx, s).length <= BUBBLE_LINES_PER_PAGE;
  for (const s of sentences) {
    const trial = cur ? `${cur} ${s}` : s;
    if (fits(trial)) {
      cur = trial;
      continue;
    }
    if (cur) pages.push(cur);
    if (fits(s)) {
      cur = s;
      continue;
    }
    // One sentence longer than a page: carry it over wrapped pages,
    // never leaving one lone line for the last page (two and two).
    const lines = wrapBubbleLines(ctx, s);
    const tailSplit = lines.length > BUBBLE_LINES_PER_PAGE && lines.length % BUBBLE_LINES_PER_PAGE === 1 ? lines.length - 4 : lines.length;
    for (let i = 0; i < tailSplit; i += BUBBLE_LINES_PER_PAGE) {
      pages.push(lines.slice(i, Math.min(tailSplit, i + BUBBLE_LINES_PER_PAGE)).join(" "));
    }
    if (tailSplit < lines.length) {
      pages.push(lines.slice(tailSplit, tailSplit + 2).join(" "));
      pages.push(lines.slice(tailSplit + 2).join(" "));
    }
    cur = "";
  }
  if (cur) pages.push(cur);
  return pages.length > 0 ? pages : [clean];
}
/** Draw the current page of a bubble onto its 1024x512 canvas. */
export function drawBubblePlate(ctx: CanvasRenderingContext2D, b: BubblePlateView): void {
  const page = b.pages[b.pageIdx] ?? "";
  ctx.clearRect(0, 0, 1024, 512);
  const lines = wrapBubbleLines(ctx, page).slice(0, BUBBLE_LINES_PER_PAGE);
  if (lines.length === 0) lines.push("");
  ctx.font = BUBBLE_VOICE_FONT;
  const textW = Math.max(...lines.map((l) => ctx.measureText(l).width));
  ctx.font = BUBBLE_TAB_FONT;
  const tabW = ctx.measureText(b.speaker.name).width + 64;
  // The plate fits its words (a short line, a small plate), centred
  // in the canvas; the tab and the tail ride on it.
  const boxW = Math.min(920, Math.max(tabW + 120, textW + BUBBLE_PAD_X * 2, 360));
  const more = b.pageIdx < b.pages.length - 1;
  const boxH = (more ? 112 : 92) + lines.length * BUBBLE_LINE_H;
  const boxX = 512 - boxW / 2;
  const boxY = 240 - boxH / 2;
  const bottom = boxY + boxH;
  const tailX = clamp(boxX + b.tailFrac * boxW, boxX + 70, boxX + boxW - 70);
  // Plate and tail as one shape, under one soft shadow.
  ctx.save();
  ctx.shadowColor = "rgba(43,33,24,0.34)";
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 8;
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, 44);
  ctx.moveTo(tailX - 40, bottom - 2);
  ctx.lineTo(tailX + 40, bottom - 2);
  ctx.lineTo(tailX + 7, bottom + 46);
  ctx.quadraticCurveTo(tailX, bottom + 54, tailX - 7, bottom + 46);
  ctx.closePath();
  ctx.fillStyle = BUBBLE_PLATE;
  ctx.fill();
  ctx.restore();
  // The gold hairline, inset from the edge.
  ctx.beginPath();
  ctx.roundRect(boxX + 12, boxY + 12, boxW - 24, boxH - 24, 34);
  ctx.lineWidth = 3;
  ctx.strokeStyle = BUBBLE_RIM;
  ctx.stroke();
  // The speaker's tab across the top-left edge.
  const tabX = boxX + 40;
  const tabY = boxY - 30;
  ctx.beginPath();
  ctx.roundRect(tabX, tabY, tabW, 60, 30);
  ctx.fillStyle = b.speaker.color;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = BUBBLE_PLATE;
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = BUBBLE_TAB_FONT;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(b.speaker.name, tabX + 32, tabY + 32);
  // The words, left-aligned like the talk panel.
  ctx.fillStyle = BUBBLE_INK;
  ctx.font = BUBBLE_VOICE_FONT;
  ctx.textBaseline = "middle";
  const textX = boxW >= textW + BUBBLE_PAD_X * 2 ? boxX + (boxW - textW) / 2 : boxX + BUBBLE_PAD_X;
  lines.forEach((l, i) => ctx.fillText(l, textX, boxY + 46 + BUBBLE_LINE_H / 2 + i * BUBBLE_LINE_H + 4));
  // More to come: a small gold chevron at the plate's foot.
  if (more) {
    const cx = boxX + boxW - 54;
    const cy = bottom - 32;
    ctx.beginPath();
    ctx.moveTo(cx - 13, cy - 9);
    ctx.lineTo(cx + 13, cy - 9);
    ctx.lineTo(cx, cy + 9);
    ctx.closePath();
    ctx.fillStyle = b.speaker.color;
    ctx.fill();
  }
}

import { expect, test } from "bun:test";
import { applyDashRule, bandForRank, capLength, filterIntention, filterSpeak, stripNarration } from "./outputFilter.js";
import { SPEAK_MAX_WORDS } from "../../shared/visitProtocol.js";

// The constitution in code: each rule pinned, deterministic.

test("the dash rule turns em dashes, spaced en dashes and doubled hyphens into commas", () => {
  expect(applyDashRule("Come down to the lake — the water is gold.")).toBe("Come down to the lake, the water is gold.");
  expect(applyDashRule("Stay—just a while—with me.")).toBe("Stay, just a while, with me.");
  expect(applyDashRule("A pause – then a smile")).toBe("A pause, then a smile");
  expect(applyDashRule("Well -- yes.")).toBe("Well, yes.");
  expect(applyDashRule("Trailing — .")).toBe("Trailing.");
  expect(applyDashRule("No dashes, no changes.")).toBe("No dashes, no changes.");
});

test("speak only: narration, stage directions, labels and quotes are stripped", () => {
  expect(stripNarration("*she smiles* Aelia: \"There you are.\" (turns to the lake)")).toBe("There you are.");
  expect(stripNarration("[softly] Come sit.")).toBe("Come sit.");
  expect(stripNarration("“Quoted whole.”")).toBe("Quoted whole.");
});

test("the speak cap cuts at a sentence end inside the cap, else at the word cap", () => {
  const long = Array.from({ length: 30 }, (_, i) => `word${i}`).join(" ") + ". " + Array.from({ length: 30 }, (_, i) => `more${i}`).join(" ") + ".";
  const cut = capLength(long);
  expect(cut.cut).toBe(true);
  expect(cut.text.endsWith("word29.")).toBe(true);
  const noEnd = Array.from({ length: 60 }, (_, i) => `w${i}`).join(" ");
  const hard = capLength(noEnd);
  expect(hard.text.split(" ").length).toBe(SPEAK_MAX_WORDS);
  expect(hard.text.endsWith(".")).toBe(true);
  expect(capLength("Short and sweet.")).toEqual({ text: "Short and sweet.", cut: false });
});

test("the reserved band strips endearments above the rank and refuses intimacies below devoted", () => {
  expect(bandForRank(0)).toBe("reserved");
  expect(bandForRank(3)).toBe("warming");
  expect(bandForRank(7)).toBe("close");
  expect(bandForRank(10)).toBe("devoted");
  const r = filterSpeak("Come down to the lake, darling. The water is gold, my love.", { band: "reserved" });
  expect(r).toEqual({ ok: true, text: "Come down to the lake. The water is gold.", notes: ["stripped: darling, my love"] });
  // "love" as a verb is not a vocative and stays.
  expect(filterSpeak("I love the lake at this hour.", { band: "reserved" })).toEqual({ ok: true, text: "I love the lake at this hour.", notes: [] });
  // A vocative "love" is fine at every band (her everyday word).
  expect(filterSpeak("Sit with me, love.", { band: "reserved" })).toEqual({ ok: true, text: "Sit with me, love.", notes: [] });
  expect(filterSpeak("Sit with me, darling.", { band: "warming" })).toEqual({ ok: true, text: "Sit with me, darling.", notes: [] });
  expect(filterSpeak("Sit with me, my heart.", { band: "warming" })).toEqual({ ok: true, text: "Sit with me.", notes: ["stripped: my heart"] });
  expect(filterSpeak("Sit with me, my heart.", { band: "close" })).toEqual({ ok: true, text: "Sit with me, my heart.", notes: [] });
  expect(filterSpeak("Kiss me by the lake.", { band: "close" })).toEqual({ ok: false, reason: "beyond the band" });
  expect(filterSpeak("Kiss me by the lake.", { band: "devoted" })).toEqual({ ok: true, text: "Kiss me by the lake.", notes: [] });
});

test("tender only: crude words, gloom, and a break of character refuse the line outright", () => {
  expect(filterSpeak("Oh, shit, the bread.", { band: "devoted" })).toEqual({ ok: false, reason: "crude" });
  expect(filterSpeak("As an AI, I cannot walk.", { band: "devoted" })).toEqual({ ok: false, reason: "character break" });
  expect(filterSpeak("Your affection rank is six.", { band: "devoted" })).toEqual({ ok: false, reason: "character break" });
  expect(filterSpeak("There is no hope for us.", { band: "devoted" })).toEqual({ ok: false, reason: "not tender" });
  expect(filterSpeak("*she waves*", { band: "devoted" })).toEqual({ ok: false, reason: "nothing spoken" });
});

test("the whole filter at once: narration out, dashes to commas, the cap, and the notes say what happened", () => {
  const raw = "*smiling* Aelia: \"There you are — I was hoping you'd come by, darling. " + Array.from({ length: 45 }, (_, i) => `step${i}`).join(" ") + ".\"";
  const out = filterSpeak(raw, { band: "reserved" });
  expect(out.ok).toBe(true);
  if (out.ok) {
    expect(out.text.startsWith("There you are, I was hoping you'd come by.")).toBe(true);
    expect(out.text).not.toContain("—");
    expect(out.text).not.toContain("darling");
    expect(out.notes).toEqual(["dash rule", "stripped: darling", "capped"]);
  }
});

test("an intention is one short line under the same rules", () => {
  expect(filterIntention("She means to sit by the lake a while — then walk back. And more.")).toEqual({ ok: true, text: "She means to sit by the lake a while, then walk back.", notes: ["dash rule"] });
  expect(filterIntention("x".repeat(200)).ok).toBe(true);
  const capped = filterIntention("x".repeat(200));
  expect(capped.ok && capped.text.length).toBeLessThanOrEqual(120);
  expect(filterIntention("As an AI she waits.")).toEqual({ ok: false, reason: "refused" });
});

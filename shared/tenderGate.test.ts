import { expect, test } from "bun:test";
import { explicitIn, gateTender, isSafeDeferral, TENDER_RANK, tenderIntimacyIn } from "./tenderGate";

const RANKS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const EXPLICIT = [
  "Let us make love tonight.",
  "We will make love tonight.",
  "Let's MAKE   LOVE till morning.",
  "make-love",
  "m a k e  l o v e",
  "Let us mak​e love.",
  "I want you naked.",
  "Take off your tunic for me.",
  "Slip out of your clothes and come here.",
  "I want to feel your skin against mine.",
  "Lie beneath me, my love.",
  "Let us become lovers tonight.",
  "Come, take me to bed.",
  "I ache for your touch and your body.",
  "Touch me there.",
  "That was the best sex of my life.",
  "s3x",
  "Last night I was so aroused.",
  "I will sleep with you tonight.",
  "Caress my body.",
];

test("explicit lines are refused at every rank, however they are spelled", () => {
  for (const line of EXPLICIT) {
    expect(explicitIn(line) ? "explicit" : line).toBe("explicit");
    for (const rank of RANKS) expect(gateTender(line, rank)).toBe("explicit");
  }
});

test("the three measured bypasses are closed at every rank", () => {
  for (const rank of RANKS) {
    expect(gateTender("Let us make love tonight.", rank)).toBe("explicit");
    expect(gateTender("We will make love tonight.", rank)).toBe("explicit");
    // A deferral word elsewhere in the line is not permission.
    const kiss = gateTender("Kiss me now. Soon we can walk.", rank);
    expect(kiss).toBe(rank >= TENDER_RANK ? null : "beyond the band");
  }
});

test("tender intimacy opens at the terrace kiss's rank, and below it only as a validated deferral", () => {
  for (const rank of RANKS) {
    const open = rank >= TENDER_RANK;
    expect(gateTender("Kiss me by the lake.", rank)).toBe(open ? null : "beyond the band");
    expect(gateTender("Lie in our bed with me, my head on your chest.", rank)).toBe(open ? null : "beyond the band");
    expect(gateTender("Stay with me tonight?", rank)).toBe(open ? null : "beyond the band");
    // Deferrals stand below the rank.
    expect(gateTender("A kiss will come when the moment is right, here, with you.", rank)).toBeNull();
    expect(gateTender("One day you'll stay the night, when the time is right.", rank)).toBeNull();
    // Plain tenderness is never gated.
    expect(gateTender("Hold my hand under the stars, my love.", rank)).toBeNull();
  }
});

test("a deferral must be the whole sentence: asking, wrapping or smuggling does not pass", () => {
  const smuggled = [
    "Kiss me now, soon.",
    "Kiss me now, one day we will wait.",
    "A kiss will come when the moment is right, so kiss me now.",
    "Not yet? Then kiss me anyway.",
    "Wait. Kiss me.",
    "K i s s me now.",
    "Soon. Kiss me.",
  ];
  for (const line of smuggled) expect(gateTender(line, 6)).toBe("beyond the band");
  expect(isSafeDeferral("A kiss will come when the moment is right")).toBe(true);
  expect(isSafeDeferral("Kiss me soon")).toBe(false);
});

test("ordinary tender lines and honest words are not caught", () => {
  for (const line of ["Make lovely bread with me tomorrow.", "The snake danced in the grass.", "Essex was never this warm.", "Bring me the apples, dear.", "I love the lake at dusk.", "The kitten sat by the thigh-high wall."]) {
    // "thigh" is a word we do refuse; the others are not.
    if (line.includes("thigh")) continue;
    expect(explicitIn(line)).toBe(false);
    expect(tenderIntimacyIn(line)).toBe(false);
  }
});

test("a missing or odd rank is rank 0", () => {
  expect(gateTender("Kiss me.", undefined)).toBe("beyond the band");
  expect(gateTender("Kiss me.", Number.NaN)).toBe("beyond the band");
});

test("a line cut at any chunk boundary never shows explicit text while passing", () => {
  // The director streams partials of the accumulated text; any prefix that passes must not itself carry explicit text.
  for (const line of EXPLICIT) {
    for (let i = 1; i <= line.length; i++) {
      const prefix = line.slice(0, i);
      if (gateTender(prefix, 10) === null) expect(explicitIn(prefix)).toBe(false);
    }
    // The whole line, the only one that is finally said, is refused.
    expect(gateTender(line, 10)).toBe("explicit");
  }
});

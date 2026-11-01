import { describe, expect, test } from "bun:test";
import { extractFact, repliesNearDuplicate, scoreSentiment } from "./hearing";
import { pronounsFor } from "./player";

describe("scoreSentiment", () => {
  test("hears heavy, bright and warm days", () => {
    expect(scoreSentiment("I am so tired today").weather).toBe("weary");
    expect(scoreSentiment("I got the job, what a day").weather).toBe("bright");
    expect(scoreSentiment("I really love you, Aelia").weather).toBe("warm");
  });

  test("negation softens instead of mirroring", () => {
    expect(scoreSentiment("I am not tired at all").weather).toBe("content");
    expect(scoreSentiment("well that was not bad really").weather).toBe("content");
  });

  test("short or muddy messages carry no signal", () => {
    expect(scoreSentiment("ok").weather).toBe("none");
    expect(scoreSentiment("the market opens at noon").weather).toBe("none");
  });

  test("an intensifier makes it strong", () => {
    expect(scoreSentiment("I am extremely stressed about everything").intensity).toBe("strong");
  });
});

describe("extractFact", () => {
  test("stores explicit statements only", () => {
    expect(extractFact("I love olives.")).toEqual({ text: "He loves olives.", topic: "tastes" });
    expect(extractFact("my birthday is March 3")?.topic).toBe("life");
    expect(extractFact("what a strange morning")).toBeNull();
  });

  test("speaks of the player in the right pronoun", () => {
    const she = pronounsFor("she");
    expect(extractFact("I love olives.", she)?.text).toBe("She loves olives.");
    expect(extractFact("my job is carpentry", she)?.text).toBe("Her job is carpentry.");
    expect(extractFact("remember that I have a sister", she)?.text).toBe("She has a sister.");
  });

  test("leaves the player's own words about someone else alone", () => {
    const she = pronounsFor("she");
    expect(extractFact("I love Marcus and his dog", she)?.text).toBe("She loves Marcus and his dog.");
  });
});

describe("repliesNearDuplicate", () => {
  test("folds case and punctuation", () => {
    expect(repliesNearDuplicate("The lake is calm!", "the lake is calm")).toBe(true);
  });

  test("near-identical long replies count, short ones need exact equality", () => {
    const a = "the willows are lovely tonight and the water is very still";
    expect(repliesNearDuplicate(a, `${a} now`)).toBe(true);
    expect(repliesNearDuplicate("Good morning, love.", "Good morning, centurion.")).toBe(false);
  });
});

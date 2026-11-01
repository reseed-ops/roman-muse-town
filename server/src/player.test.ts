import { expect, test } from "bun:test";
import { PLAYER_PRONOUN, aboutPlayer, pronounsFor } from "./player";

const she = pronounsFor("she");

test("the default town changes nothing", () => {
  expect(PLAYER_PRONOUN).toBe("he");
  expect(aboutPlayer("He told him his name.")).toBe("He told him his name.");
});

test("a woman player reads correctly", () => {
  expect(aboutPlayer("He kept his word, and she thanked him.", she)).toBe(
    "She kept her word, and she thanked her.",
  );
  expect(aboutPlayer("a man started kicking its pebbles like he meant it", she)).toBe(
    "a woman started kicking its pebbles like she meant it",
  );
});

test("word boundaries hold", () => {
  expect(aboutPlayer("the hearth, the theme, this mantle", she)).toBe("the hearth, the theme, this mantle");
});

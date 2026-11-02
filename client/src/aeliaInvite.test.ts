import { expect, test } from "bun:test";
import { chooseInvite, freshMemory, inviteLines } from "./aeliaInvite";
import { dayRhythm } from "./dayRhythm";
import type { RomanDate } from "./romanDay";

const date: RomanDate = { month: 6, day: 10, marked: null, market: false };
const calm = { unreadLetters: 0, gardenReady: false, treeWatered: true };
const morning = dayRhythm(2, date, null);
const memory = freshMemory("2026-06-10");

test("every invitation has at least three ways of asking and of arriving", () => {
  for (const { ask, arrive } of Object.values(inviteLines)) {
    expect(ask.length).toBeGreaterThanOrEqual(3);
    expect(arrive.length).toBeGreaterThanOrEqual(3);
  }
});

test("she asks once in each part of the day", () => {
  const invite = chooseInvite(morning, calm, memory, 0.9)!;
  expect(invite.id).toBe("market:morning");
  expect(chooseInvite(morning, calm, { ...memory, asked: ["morning"] }, 0.9)).toBeNull();
  expect(chooseInvite(dayRhythm(6, date, null), calm, { ...memory, asked: ["morning"] }, 0.9)).not.toBeNull();
});

test("a no keeps her quiet for the day", () => {
  expect(chooseInvite(dayRhythm(10, date, null), calm, { ...memory, declined: true }, 0.5)).toBeNull();
});

test("real things come before the hour's habit", () => {
  expect(chooseInvite(morning, { ...calm, unreadLetters: 1 }, memory, 0.9)!.id).toBe("letter:morning");
  expect(chooseInvite(morning, { ...calm, gardenReady: true }, memory, 0.9)!.id).toBe("garden:morning");
  expect(chooseInvite(morning, { ...calm, treeWatered: false }, memory, 0.9)!.id).toBe("tree:morning");
});

test("the tree can wait until morning", () => {
  const night = chooseInvite(dayRhythm(null, date, null), { ...calm, treeWatered: false }, memory, 0.9)!;
  expect(night.id).toBe("lake:night");
});

test("a festival outranks everything", () => {
  const feast = dayRhythm(6, date, "Vinalia");
  expect(chooseInvite(feast, { ...calm, unreadLetters: 2 }, memory, 0.5)!.id).toBe("festival:midday");
});

test("the fish only run at the ends of the day", () => {
  expect(chooseInvite(morning, calm, memory, 0.1)!.id).toBe("fish:morning");
  expect(chooseInvite(dayRhythm(6, date, null), calm, memory, 0.1)!.id).toBe("baths:midday");
});

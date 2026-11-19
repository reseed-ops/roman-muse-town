import { describe, expect, test } from "bun:test";
import { QUESTS, questDueLabel, questDueOffset } from "./town";

describe("quest due labels (Task 111)", () => {
  const now = new Date(2026, 10, 18, 9, 0);

  test("every dated quest shows a real date, never bracketed text", () => {
    const labels = QUESTS.map((q) => questDueLabel(q, now)).filter((l): l is string => l != null);
    expect(labels.length).toBe(6);
    for (const l of labels) {
      expect(l).not.toMatch(/[\[\]]|DATE|TEMPLATE/);
      expect(l).toMatch(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}$/);
    }
    expect(questDueLabel(QUESTS[0]!, now)).toBe("Due Dec 9");
    expect(questDueLabel(QUESTS.find((q) => q.id === "petition-restored")!, now)).toBe("Check Mar 18");
    expect(questDueLabel(QUESTS.find((q) => q.id === "water-the-tree")!, now)).toBeUndefined();
  });

  test("the task companion still sees no dated quest (behaviour unchanged)", () => {
    for (const q of QUESTS) expect(questDueOffset(q.due ?? "", now)).toBeNull();
  });
});

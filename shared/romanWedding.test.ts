import { describe, expect, test } from "bun:test";
import { HOME_KEEPSAKES } from "./homeDecor";
import { TENDER_RANK, gateTender } from "./tenderGate";
import {
  CEREMONY, WEDDING_LINES_ANY_RANK, WEDDING_LINES_TENDER, WEDDING_PREP, WEDDING_RANK, WEDDING_STEPS,
  canHold, emptyWedding, hold, markWeddingCelebrated, nextStep, prepare, readWeddingBook, townDressed, weddingOffered, weddingPending,
} from "./romanWedding";

const R = WEDDING_RANK;
const prepared = () => prepare(prepare(prepare(emptyWedding(), "flowers", R), "vows", R), "dress", R);

describe("Task 58: the chain of preparations", () => {
  test("it is offered at the terrace kiss's rank, using the existing constant, and no lower", () => {
    expect(WEDDING_RANK).toBe(TENDER_RANK);
    expect(weddingOffered(TENDER_RANK - 1)).toBe(false);
    expect(weddingOffered(TENDER_RANK)).toBe(true);
    expect(prepare(emptyWedding(), "flowers", TENDER_RANK - 1)).toEqual(emptyWedding());
  });

  test("flowers, then vows, then the town dressed: only in that order, a repeat changes nothing", () => {
    expect([...WEDDING_STEPS]).toEqual(["flowers", "vows", "dress"]);
    const b0 = emptyWedding();
    expect(prepare(b0, "vows", R)).toBe(b0);
    expect(prepare(b0, "dress", R)).toBe(b0);
    const b1 = prepare(b0, "flowers", R);
    expect(b1.steps).toEqual(["flowers"]);
    expect(prepare(b1, "flowers", R)).toBe(b1);
    expect(prepare(b1, "dress", R)).toBe(b1);
    expect(nextStep(b1)).toBe("vows");
    expect(prepared().steps).toEqual(["flowers", "vows", "dress"]);
    expect(nextStep(prepared())).toBeNull();
  });

  test("the ceremony needs every preparation and the rank", () => {
    expect(canHold(emptyWedding(), R)).toBe(false);
    expect(hold(prepare(emptyWedding(), "flowers", R), R).weddings).toBe(0);
    expect(canHold(prepared(), R - 1)).toBe(false);
    expect(hold(prepared(), R - 1).weddings).toBe(0);
    expect(canHold(prepared(), R)).toBe(true);
  });

  test("it is held once: a second ceremony, or more preparation, changes nothing", () => {
    const held = hold(prepared(), R);
    expect(held).toMatchObject({ weddings: 1, celebrated: false });
    expect(hold(held, R)).toBe(held);
    expect(prepare(held, "flowers", R)).toBe(held);
    expect(canHold(held, R)).toBe(false);
    const done = markWeddingCelebrated(held);
    expect(done).toMatchObject({ weddings: 1, celebrated: true });
    expect(markWeddingCelebrated(done)).toBe(done);
    expect(hold(done, 10).weddings).toBe(1);
  });

  test("the town is dressed from the dressing until the day, and not after", () => {
    expect(townDressed(emptyWedding())).toBe(false);
    expect(townDressed(prepare(prepare(emptyWedding(), "flowers", R), "vows", R))).toBe(false);
    expect(townDressed(prepared())).toBe(true);
    expect(townDressed(hold(prepared(), R))).toBe(false);
    expect(weddingPending(hold(prepared(), R))).toBe(true);
    expect(weddingPending(markWeddingCelebrated(hold(prepared(), R)))).toBe(false);
  });

  test("the stored book keeps only valid fields, a valid prefix, and one wedding at most", () => {
    expect(readWeddingBook(null)).toEqual(emptyWedding());
    expect(readWeddingBook({ steps: ["vows", "flowers"] }).steps).toEqual([]);
    expect(readWeddingBook({ steps: ["flowers", "dress"] }).steps).toEqual(["flowers"]);
    expect(readWeddingBook({ steps: [], weddings: 5, celebrated: true, points: 9 })).toEqual({ steps: [...WEDDING_STEPS], weddings: 1, celebrated: true });
    expect(Object.keys(readWeddingBook({ steps: [], coins: 3 })).sort()).toEqual(["celebrated", "steps", "weddings"]);
  });
});

describe("Task 58: her words and the tender line", () => {
  test("every line she says passes the gate at every rank from 0 to 10", () => {
    for (const line of WEDDING_LINES_ANY_RANK) for (let rank = 0; rank <= 10; rank++) expect(gateTender(line, rank)).toBeNull();
  });
  test("the one tender line (a kiss) passes where the wedding is offered and never below the gate", () => {
    for (const line of WEDDING_LINES_TENDER) {
      for (let rank = WEDDING_RANK; rank <= 10; rank++) expect(gateTender(line, rank)).toBeNull();
      expect(gateTender(line, WEDDING_RANK - 1)).toBe("beyond the band");
    }
  });
  test("every ceremony phase and preparation has words, scene and a button, and no line is explicit", () => {
    expect(CEREMONY.map((c) => c.id)).toEqual(["veil", "pronuba", "hands", "formula", "vows", "torch", "threshold"]);
    for (const c of CEREMONY) for (const t of [c.title, c.scene, c.line, c.button]) expect(t.length).toBeGreaterThan(5);
    for (const p of Object.values(WEDDING_PREP)) expect(p.button.length).toBeGreaterThan(5);
    expect(CEREMONY.find((c) => c.id === "formula")!.line).toContain("Ubi tu Gaius, ego Gaia");
    for (const text of [...CEREMONY.flatMap((c) => [c.scene, c.button]), ...Object.values(WEDDING_PREP).map((p) => p.text)]) {
      expect(gateTender(text, 0)).toBeNull();
    }
  });
});

describe("Task 58: the keepsake", () => {
  test("the clasped hands are a shelf keepsake of the wedding day", () => {
    const k = HOME_KEEPSAKES.find((x) => x.id === "wedding-hands");
    expect(k?.mount).toBe("shelf");
    expect(k?.earnedBy).toContain("marriage");
  });
});

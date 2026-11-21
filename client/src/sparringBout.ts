// Times are monotonic milliseconds. One round is one attack by each resident.
export type Phase = "idle" | "telegraph" | "parry" | "recovery" | "strike" | "pass" | "result";
export type Bout = {
  phase: Phase; gaius: number; archer: number; round: number;
  since: number; until: number; lastEvent: string;
};
export const idleBout = (): Bout => ({
  phase: "idle", gaius: 0, archer: 0, round: 1, since: 0, until: Infinity, lastEvent: "",
});
export const windowMs = (round: number) => 450 * Math.max(0.55, 0.92 ** (round - 1));
export const blockChance = (round: number) => Math.min(0.6, 0.25 + 0.1 * (round - 1));

function enter(b: Bout, phase: Phase, now: number, duration: number, lastEvent = b.lastEvent): Bout {
  return { ...b, phase, since: now, until: now + duration, lastEvent };
}
export const challenge = (now: number) => enter(idleBout(), "telegraph", now, 600);
export function forfeit(b: Bout, now: number) {
  return enter(b, "result", now, 3000, "Gaius leaves the ring. Archer wins by forfeit.");
}
function touch(b: Bout, who: "archer" | "gaius", now: number) {
  const next = { ...b, [who]: b[who] + 1 };
  const archer = who === "archer";
  const name = archer ? "Archer" : "Gaius";
  if (next[who] === 5) {
    const line = archer ? "The ballista is in good hands." : "The centurion remains the centurion.";
    return enter(next, "result", now, 3000, `${name} takes the bout, 5–${archer ? next.gaius : next.archer}. ${line}`);
  }
  return enter(next, archer ? "recovery" : "pass", now, 650, `${name} scores a touch.`);
}
export function advance(b: Bout, now: number): Bout {
  while (now >= b.until && b.phase !== "idle") {
    const at = b.until;
    switch (b.phase) {
      case "telegraph": b = enter(b, "parry", at, windowMs(b.round)); break;
      case "parry": b = touch(b, "archer", at); break;
      case "recovery": b = enter(b, "strike", at, windowMs(b.round)); break;
      case "strike": b = enter(b, "pass", at, 650, "Strike missed."); break;
      case "pass": b = enter({ ...b, round: b.round + 1 }, "telegraph", at, 600); break;
      case "result": return idleBout();
    }
  }
  return b;
}
export function press(b: Bout, now: number, random: () => number): Bout {
  b = advance(b, now);
  switch (b.phase) {
    case "telegraph": return touch(b, "archer", now);
    case "parry": return enter(b, "recovery", now, 650, "Clash! Archer staggers.");
    case "strike": return random() < blockChance(b.round)
      ? enter(b, "pass", now, 650, "Archer blocks.") : touch(b, "gaius", now);
    default: return b;
  }
}
export function cue(b: Bout) {
  if (b.phase === "idle") return "Spar with Archer";
  const action = { telegraph: "Archer winds up…", parry: "Parry!", strike: "Strike!", recovery: b.lastEvent, pass: b.lastEvent, result: b.lastEvent };
  return `${action[b.phase]}  Touches — Gaius ${b.gaius} · Archer ${b.archer} · Round ${b.round}`;
}

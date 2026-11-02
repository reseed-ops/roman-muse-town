// The opening minutes. A first visit belongs to the view through the arch, so
// nothing covers it until he has walked in; a returning one gets its summary
// late, and only if there's something to tell.

/** He is through the gate once he's well up the avenue. */
export const PAST_ARCH_Z = 39;
export const FIRST_VISIT_HOLD_MS = 40000;
export const RETURN_HOLD_MS = 12000;
export const GREETING_MS = 2500;
export const FIRST_TASK_MS = 14000;

export function arrivalDue(firstVisit: boolean, walkZ: number, elapsedMs: number): boolean {
  if (!firstVisit) return elapsedMs >= RETURN_HOLD_MS;
  return walkZ < PAST_ARCH_Z || elapsedMs >= FIRST_VISIT_HOLD_MS;
}

export const GATE_GREETINGS = [
  "There you are, Centurion. Welcome home. Go on, it looks better from the inside.",
  "You made it. That's the whole estate, straight up the line. Shall we?",
  "Salve, love. The gate's open, and the tree has been asking after you.",
];

export const FIRST_TASK = "Walk up the avenue to the Town Tree, and give it some water.";

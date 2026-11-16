// The depth buttons while swimming (Task 100, fixed in Task 103): A rises,
// B sinks. Each source (keyboard, pad, on-screen) keeps its own held state
// and the scene is told their union. The shell owns this state, the scene
// only mirrors the aggregate; so it is the shell that clears it (window
// focus lost, a pointer let go outside) and that re-sends it to a scene
// built after the buttons went down.
export type SwimSrc = "kb" | "pad" | "touch";
export type SwimHeld = Record<SwimSrc, [boolean, boolean]>;

export const newSwimHeld = (): SwimHeld => ({ kb: [false, false], pad: [false, false], touch: [false, false] });

/** The union of the sources for button i (0 rise, 1 sink). */
export const swimAggregate = (h: SwimHeld, i: 0 | 1): boolean => h.kb[i] || h.pad[i] || h.touch[i];

/** One source's button changes; `send` hears the aggregate whenever it may have changed. */
export function holdSwimKey(h: SwimHeld, src: SwimSrc, i: 0 | 1, down: boolean, send: (which: "rise" | "sink", down: boolean) => void) {
  if (h[src][i] === down) return;
  h[src][i] = down;
  send(i === 0 ? "rise" : "sink", swimAggregate(h, i));
}

/** Everything let go (focus lost, tab hidden): the scene hears both buttons up. */
export function releaseAllSwimKeys(h: SwimHeld, send: (which: "rise" | "sink", down: boolean) => void, gate?: PadGate) {
  if (gate) padGateBlur(gate);
  for (const src of ["kb", "pad", "touch"] as const) h[src] = [false, false];
  send("rise", false);
  send("sink", false);
}

/** A new scene is told the buttons as they stand now. */
export function resyncSwimKeys(h: SwimHeld, send: (which: "rise" | "sink", down: boolean) => void) {
  send("rise", swimAggregate(h, 0));
  send("sink", swimAggregate(h, 1));
}

// The pad's depth buttons and focus (Task 104). A pad can be read while the
// window is unfocused or the tab hidden, so the poll must not push a button
// that blur just let go of. The policy: while unfocused the pad's depth
// buttons count as up, and when focus returns a button counts only after it
// has been seen released and pressed again (a fresh press). Why: a button
// still physically down on return is most likely the one the player was
// holding when they alt-tabbed away; re-asserting it would send them
// rising or sinking with no intent; a fresh press is always deliberate.
export type PadGate = { suppressed: [boolean, boolean] };
export const newPadGate = (): PadGate => ({ suppressed: [false, false] });

/** Focus lost or tab hidden: both pad depth buttons are suppressed until released and pressed again. */
export const padGateBlur = (g: PadGate) => {
  g.suppressed = [true, true];
};

/** One gamepad poll's depth buttons (A rise, B sink), `focused` = window focused and tab visible. */
export function pollPadDepth(
  h: SwimHeld,
  g: PadGate,
  focused: boolean,
  now: readonly [boolean, boolean],
  send: (which: "rise" | "sink", down: boolean) => void,
) {
  if (!focused) padGateBlur(g);
  for (const i of [0, 1] as const) {
    if (!now[i]) g.suppressed[i] = false;
    holdSwimKey(h, "pad", i, focused && now[i] && !g.suppressed[i], send);
  }
}

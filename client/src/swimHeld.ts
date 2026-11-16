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
export function releaseAllSwimKeys(h: SwimHeld, send: (which: "rise" | "sink", down: boolean) => void) {
  for (const src of ["kb", "pad", "touch"] as const) h[src] = [false, false];
  send("rise", false);
  send("sink", false);
}

/** A new scene is told the buttons as they stand now. */
export function resyncSwimKeys(h: SwimHeld, send: (which: "rise" | "sink", down: boolean) => void) {
  send("rise", swimAggregate(h, 0));
  send("sink", swimAggregate(h, 1));
}

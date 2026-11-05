/**
 * Player 2 routing (Task 3, Nov 3 2026): which physical gamepad drives
 * whom, how its sticks and buttons become the town's input shapes, the
 * keyboard stand-in for a second pad, the fold-back clock, and the
 * town menu's status line. Pure, so each rule is pinned by a test.
 *
 * Seats: the Gamepad API only lists a pad once a button on it has been
 * pressed (its privacy behaviour), so appearing in the list IS the
 * announcement. The first pad to appear takes Gaius (seat p1), the
 * next distinct pad takes Aelia (seat p2). A pad keeps its seat while
 * it stays connected, and a pad that vanishes frees its seat without
 * reshuffling the other one: two players never swap characters because
 * one controller blinked.
 */
export const PAD_BUTTONS = { a: 0, b: 1, x: 2, y: 3 } as const;
export type PadButton = keyof typeof PAD_BUTTONS;
/** Stick travel below this is rest; the rest rescales to a full 0..1. */
export const STICK_DEAD_ZONE = 0.15;
/** Seconds of pad2 silence before she folds back to her own mind. */
export const PAD2_IDLE_SEC = 3;

export type PadSeat = { index: number; id: string };
export type PadSeats = { p1: PadSeat | null; p2: PadSeat | null };
export const noPads = (): PadSeats => ({ p1: null, p2: null });

export function routePads(prev: PadSeats, connected: readonly PadSeat[]): PadSeats {
  const keep = (seat: PadSeat | null): PadSeat | null =>
    seat && connected.some((pad) => pad.index === seat.index && pad.id === seat.id) ? seat : null;
  let p1 = keep(prev.p1);
  let p2 = keep(prev.p2);
  for (const pad of connected) {
    if (p1?.index === pad.index || p2?.index === pad.index) continue;
    if (!p1) p1 = pad;
    else if (!p2) p2 = pad;
  }
  return { p1, p2 };
}

/** Raw stick axes (the API's Y grows downward) to the town's pad
 *  vector, where up is forward: a dead zone, then a radial rescale so
 *  the first real tilt starts at zero instead of jumping to 0.15. */
export function stickVector(ax: number, ay: number, deadZone = STICK_DEAD_ZONE): { x: number; y: number } {
  const mag = Math.hypot(ax, ay);
  if (mag < deadZone) return { x: 0, y: 0 };
  const scaled = Math.min(1, (mag - deadZone) / (1 - deadZone));
  return { x: (ax / mag) * scaled, y: (-ay / mag) * scaled };
}

/** The shoulders, standard mapping: LB is button 4, RB is 5. */
export const PAD_SHOULDERS = { LB: 4, RB: 5 } as const;
export type PadShoulder = keyof typeof PAD_SHOULDERS;

/** The shoulders that are down now and were not a frame ago. */
export function pressedShoulders(prev: readonly boolean[], now: readonly boolean[]): PadShoulder[] {
  const out: PadShoulder[] = [];
  for (const name of Object.keys(PAD_SHOULDERS) as PadShoulder[]) {
    const i = PAD_SHOULDERS[name];
    if (now[i] && !prev[i]) out.push(name);
  }
  return out;
}

/** The face buttons that are down now and were not a frame ago. */
export function pressedButtons(prev: readonly boolean[], now: readonly boolean[]): PadButton[] {
  const out: PadButton[] = [];
  for (const name of Object.keys(PAD_BUTTONS) as PadButton[]) {
    const i = PAD_BUTTONS[name];
    if (now[i] && !prev[i]) out.push(name);
  }
  return out;
}

/** The keyboard stand-in for pad2. WASD and the arrows already belong
 *  to Gaius in the scene, so she takes the right hand's cluster: IJKL
 *  for the stick, U for A (jump), O for B (slide), P for X (sit or
 *  wave). Y is unused on pad2 and has no key. */
export const PAD2_KEYS = { up: "i", left: "j", down: "k", right: "l", a: "u", b: "o", x: "p" } as const;

export function isPad2Key(key: string): boolean {
  return (Object.values(PAD2_KEYS) as string[]).includes(key);
}

export function keyboardStick(keysDown: ReadonlySet<string>): { x: number; y: number } {
  let x = 0;
  let y = 0;
  if (keysDown.has(PAD2_KEYS.up)) y += 1;
  if (keysDown.has(PAD2_KEYS.down)) y -= 1;
  if (keysDown.has(PAD2_KEYS.left)) x -= 1;
  if (keysDown.has(PAD2_KEYS.right)) x += 1;
  const mag = Math.hypot(x, y);
  return mag > 1 ? { x: x / mag, y: y / mag } : { x, y };
}

export function keyboardButton(key: string): Exclude<PadButton, "y"> | null {
  if (key === PAD2_KEYS.a) return "a";
  if (key === PAD2_KEYS.b) return "b";
  if (key === PAD2_KEYS.x) return "x";
  return null;
}

/** Fold-back: pad2 owns her while its last input is fresher than
 *  PAD2_IDLE_SEC; a breath later her own mind resumes mid-stride. */
export const pad2Live = (lastInputAt: number, now: number): boolean => now - lastInputAt < PAD2_IDLE_SEC;

/** Who holds pad2: a physical pad, the keyboard stand-in, or (Task 4)
 *  a visiting director's pad verb, a held vector that decays on its own. */
export type Pad2Source = "pad" | "keyboard" | "director";

/** Who moves her right now, as the scene reports it. */
export type AeliaDriver = Pad2Source | "harness" | "self";

export type Pad2StatusInput = {
  padConnected: boolean;
  driver: AeliaDriver;
  /** Her companion follow mode (walking with him on her own). */
  following: boolean;
  harness: "off" | "beside" | "behind";
};

/** The town menu's status line: who drives Aelia, then the second
 *  pad's connection, in plain words. */
export function pad2StatusLine(input: Pad2StatusInput): string {
  const driver =
    input.driver === "pad"
      ? "Aelia: driven by the second controller."
      : input.driver === "keyboard"
        ? "Aelia: driven by the keyboard."
        : input.driver === "director"
          ? "Aelia: driven by Muse's channel."
        : input.driver === "harness"
          ? `Aelia: follow driver, ${input.harness === "behind" ? "behind" : "beside"} Gaius.`
          : input.following
            ? "Aelia: walking with you on her own."
            : "Aelia: keeping her own routine.";
  const pad = input.padConnected
    ? "Second controller connected."
    : "No second controller; keyboard IJKL moves her, U jumps, O slides, P sits or waves.";
  return `${driver} ${pad}`;
}

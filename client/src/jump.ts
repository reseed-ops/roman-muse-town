/** The hop: Rome Life's numbers, launch 7 against gravity 25, which peaks
 *  about one unit up and lands about half a second later. A toy verb, for
 *  the joy of it; the walker's collision and height stay as they are. */
export const JUMP_SPEED = 7;
export const JUMP_GRAVITY = 25;
/** A press this close before landing still counts. */
export const JUMP_BUFFER_SEC = 0.12;

export type JumpState = { y: number; vy: number; queuedAt: number };

export const newJump = (): JumpState => ({ y: 0, vy: 0, queuedAt: -Infinity });

export const airborne = (jump: JumpState): boolean => jump.y > 0 || jump.vy > 0;

/** Advance one frame. Returns true on the frame he lands. */
export function stepJump(jump: JumpState, dt: number, now: number, free: boolean): boolean {
  if (!free) {
    Object.assign(jump, newJump());
    return false;
  }
  if (!airborne(jump) && now - jump.queuedAt <= JUMP_BUFFER_SEC) {
    jump.vy = JUMP_SPEED;
    jump.queuedAt = -Infinity;
  }
  if (!airborne(jump)) return false;
  jump.vy -= JUMP_GRAVITY * dt;
  jump.y += jump.vy * dt;
  if (jump.y > 0) return false;
  jump.y = 0;
  jump.vy = 0;
  return true;
}

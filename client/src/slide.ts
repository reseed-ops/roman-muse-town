/** The run slide: a burst of speed on the way in, bleeding off to a jog, in
 *  the direction he was going. It can't be steered or chained. */
export const SLIDE_SEC = 0.75;
const SLIDE_COOLDOWN_SEC = 0.4;
const SLIDE_SPEED_IN = 8;
const SLIDE_SPEED_OUT = 3;

export type SlideState = { left: number; dirX: number; dirZ: number; readyAt: number };

export const newSlide = (): SlideState => ({ left: 0, dirX: 0, dirZ: 1, readyAt: 0 });

export const sliding = (slide: SlideState): boolean => slide.left > 0;

/** B is worked with a finger, and the pressing gesture itself centres
 *  the stick, so a press still counts as "on the move" if he was moving
 *  a breath ago. Without the latch every touch slide was refused for
 *  arriving a frame after the motion it was meant to catch. */
export const SLIDE_LATCH_SEC = 0.25;

export function wasMovingRecently(lastMovingAt: number, now: number): boolean {
  return now - lastMovingAt <= SLIDE_LATCH_SEC;
}

export function startSlide(slide: SlideState, dirX: number, dirZ: number, now: number): boolean {
  if (sliding(slide) || now < slide.readyAt) return false;
  const len = Math.hypot(dirX, dirZ);
  if (len < 0.0001) return false;
  slide.left = SLIDE_SEC;
  slide.dirX = dirX / len;
  slide.dirZ = dirZ / len;
  return true;
}

export function endSlide(slide: SlideState, now: number): void {
  slide.left = 0;
  slide.readyAt = now + SLIDE_COOLDOWN_SEC;
}

/** Slows gently, then more, so the end of it settles into the walk. */
export function slideSpeed(slide: SlideState): number {
  const k = 1 - Math.max(0, slide.left) / SLIDE_SEC;
  return SLIDE_SPEED_IN + (SLIDE_SPEED_OUT - SLIDE_SPEED_IN) * k * k;
}

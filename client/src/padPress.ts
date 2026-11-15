// Task 97: press feedback for the virtual pad buttons (ABXY, LB/RB, LT/RT,
// the overview chip). The fill used to ride on CSS `:active` alone. A
// browser's :active is a single, mouse-derived state: with the stick held
// by another finger (and with pointerdown's preventDefault suppressing the
// compatibility events that feed it) it never reached the second thumb's
// button. Pointer events are per finger and always fire, so the pressed
// state is now an attribute set from them: `data-pressed` on press, cleared
// on release, cancel, or lost capture. The classes style `data-[pressed]:`
// exactly as they styled `active:`; the button's action is untouched.
import type { PointerEvent as ReactPointerEvent } from "react";

type PressEvent = Pick<ReactPointerEvent<HTMLElement>, "currentTarget">;

export function padPressOn(e: PressEvent): void {
  e.currentTarget.setAttribute("data-pressed", "1");
}

export function padPressOff(e: PressEvent): void {
  e.currentTarget.removeAttribute("data-pressed");
}

/** Spread on a button whose own onPointerDown calls padPressOn (or use PAD_PRESS_ALL). */
export const PAD_PRESS_RELEASE = {
  onPointerUp: padPressOff,
  onPointerCancel: padPressOff,
  onPointerLeave: padPressOff,
  onLostPointerCapture: padPressOff,
} as const;

/** For a button with no pointerdown handler of its own. */
export const PAD_PRESS_ALL = { onPointerDown: padPressOn, ...PAD_PRESS_RELEASE } as const;

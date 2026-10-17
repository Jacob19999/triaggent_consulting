/** Slide-canvas gestures for /present. A tap advances like a click; a sideways swipe turns the page. */

/** Movement still treated as a tap, not a drag. */
export const TAP_SLOP_PX = 14;
/** Horizontal travel that counts as a page swipe. */
export const SWIPE_MIN_PX = 48;

export type DeckMove = "forward" | "back";

const CONTROL = "a, button, input, select, textarea, label, summary, [role='button'], [role='tab'], [role='link']";

/** Links, buttons, and form controls keep their own tap. The rest of the slide is the click target. */
export function isDeckControl(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(CONTROL) != null;
}

/**
 * Tap anywhere → forward (the presentation click).
 * Swipe left → forward, swipe right → back.
 * A vertical or diagonal drag is ignored so it does not fight scrolling.
 */
export function classifyDeckGesture(dx: number, dy: number): DeckMove | null {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax >= SWIPE_MIN_PX && ax > ay) return dx < 0 ? "forward" : "back";
  if (ax <= TAP_SLOP_PX && ay <= TAP_SLOP_PX) return "forward";
  return null;
}

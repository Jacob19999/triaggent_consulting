import { describe, expect, it } from "vitest";
import { classifyDeckGesture } from "@/lib/deckGestures";

describe("presentation touch gestures", () => {
  it("treats a tap, including a slightly shaky finger, as a click that advances", () => {
    expect(classifyDeckGesture(0, 0)).toBe("forward");
    expect(classifyDeckGesture(8, -6)).toBe("forward");
    expect(classifyDeckGesture(-10, 4)).toBe("forward");
  });

  it("turns the page on a horizontal swipe", () => {
    expect(classifyDeckGesture(-80, 10)).toBe("forward");
    expect(classifyDeckGesture(90, -12)).toBe("back");
  });

  it("ignores a vertical drag and a short diagonal", () => {
    expect(classifyDeckGesture(4, 70)).toBeNull();
    expect(classifyDeckGesture(30, 28)).toBeNull();
  });
});

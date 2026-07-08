import { describe, expect, it } from "vitest";

import { shouldCursorBlink } from "./cursorBlink";

describe("shouldCursorBlink", () => {
  it("blinks only for the native blink animation while active and focused", () => {
    expect(shouldCursorBlink("blink", true, true)).toBe(true);
  });

  it("does not use xterm native blink for non-blink animations", () => {
    expect(shouldCursorBlink("steady", true, true)).toBe(false);
    expect(shouldCursorBlink("smooth", true, true)).toBe(false);
    expect(shouldCursorBlink("expand", true, true)).toBe(false);
  });

  it("never blinks while the window is inactive", () => {
    expect(shouldCursorBlink("blink", false, true)).toBe(false);
  });

  it("does not blink an unfocused slot", () => {
    expect(shouldCursorBlink("blink", true, false)).toBe(false);
  });
});

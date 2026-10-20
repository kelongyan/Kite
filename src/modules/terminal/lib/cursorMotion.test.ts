import { describe, expect, it } from "vitest";

import {
  coerceTerminalCursorSmoothCaretAnimation,
  isSameTerminalCursorGrid,
  resolveTerminalCursorFallback,
  shouldAnimateTerminalCursorMotion,
  shouldHoldTerminalCursorMotionForHiddenCursor,
  shouldSuppressCursorMotionForInput,
} from "./cursorMotion";

describe("terminal cursor motion", () => {
  const base = {
    preference: "explicit" as const,
    previous: { cursorX: 2, cursorY: 1 },
    next: { cursorX: 3, cursorY: 1 },
    explicit: true,
    alternateScreen: false,
    composing: false,
    reducedMotion: false,
    suppressed: false,
  };

  it("keeps supported smooth caret animation preferences", () => {
    expect(coerceTerminalCursorSmoothCaretAnimation("off")).toBe("off");
    expect(coerceTerminalCursorSmoothCaretAnimation("explicit")).toBe(
      "explicit",
    );
    expect(coerceTerminalCursorSmoothCaretAnimation("on")).toBe("on");
    expect(coerceTerminalCursorSmoothCaretAnimation("always")).toBe("explicit");
  });

  it("animates explicit small cursor moves", () => {
    expect(shouldAnimateTerminalCursorMotion(base)).toBe(true);
  });

  it("does not animate without an explicit move in explicit mode", () => {
    expect(
      shouldAnimateTerminalCursorMotion({ ...base, explicit: false }),
    ).toBe(false);
  });

  it("allows automatic small moves outside alt-screen when enabled", () => {
    expect(
      shouldAnimateTerminalCursorMotion({
        ...base,
        preference: "on",
        explicit: false,
      }),
    ).toBe(true);
  });

  it("does not automatically animate alt-screen redraws", () => {
    expect(
      shouldAnimateTerminalCursorMotion({
        ...base,
        preference: "on",
        explicit: false,
        alternateScreen: true,
      }),
    ).toBe(false);
  });

  it("does not animate unsafe movement contexts", () => {
    expect(
      shouldAnimateTerminalCursorMotion({ ...base, preference: "off" }),
    ).toBe(false);
    expect(shouldAnimateTerminalCursorMotion({ ...base, previous: null })).toBe(
      false,
    );
    expect(
      shouldAnimateTerminalCursorMotion({ ...base, composing: true }),
    ).toBe(false);
    expect(
      shouldAnimateTerminalCursorMotion({ ...base, reducedMotion: true }),
    ).toBe(false);
    expect(
      shouldAnimateTerminalCursorMotion({ ...base, suppressed: true }),
    ).toBe(false);
  });

  it("does not animate large cursor jumps", () => {
    expect(
      shouldAnimateTerminalCursorMotion({
        ...base,
        next: { cursorX: 10, cursorY: 1 },
      }),
    ).toBe(false);
    expect(
      shouldAnimateTerminalCursorMotion({
        ...base,
        next: { cursorX: 3, cursorY: 4 },
      }),
    ).toBe(false);
  });

  it("suppresses movement for large or bracketed paste input", () => {
    expect(shouldSuppressCursorMotionForInput("abc")).toBe(false);
    expect(shouldSuppressCursorMotionForInput("abcdefghi")).toBe(true);
    expect(shouldSuppressCursorMotionForInput("a\nb")).toBe(true);
    expect(shouldSuppressCursorMotionForInput("\x1b[200~pasted\x1b[201~")).toBe(
      true,
    );
  });

  it("holds the last cursor position through brief shell cursor hides", () => {
    expect(
      shouldHoldTerminalCursorMotionForHiddenCursor({
        preference: "explicit",
        previous: base.previous,
        explicit: true,
        alternateScreen: false,
        composing: false,
        reducedMotion: false,
        suppressed: false,
      }),
    ).toBe(true);
  });

  it("does not hold hidden cursor motion in unsafe contexts", () => {
    const hidden = {
      preference: "explicit" as const,
      previous: base.previous,
      explicit: true,
      alternateScreen: false,
      composing: false,
      reducedMotion: false,
      suppressed: false,
    };

    expect(
      shouldHoldTerminalCursorMotionForHiddenCursor({
        ...hidden,
        preference: "off",
      }),
    ).toBe(false);
    expect(
      shouldHoldTerminalCursorMotionForHiddenCursor({
        ...hidden,
        previous: null,
      }),
    ).toBe(false);
    expect(
      shouldHoldTerminalCursorMotionForHiddenCursor({
        ...hidden,
        explicit: false,
      }),
    ).toBe(false);
    expect(
      shouldHoldTerminalCursorMotionForHiddenCursor({
        ...hidden,
        alternateScreen: true,
      }),
    ).toBe(false);
    expect(
      shouldHoldTerminalCursorMotionForHiddenCursor({
        ...hidden,
        composing: true,
      }),
    ).toBe(false);
    expect(
      shouldHoldTerminalCursorMotionForHiddenCursor({
        ...hidden,
        reducedMotion: true,
      }),
    ).toBe(false);
    expect(
      shouldHoldTerminalCursorMotionForHiddenCursor({
        ...hidden,
        suppressed: true,
      }),
    ).toBe(false);
  });
});

describe("hidden cursor fallback hysteresis", () => {
  const pos = (cursorX: number, cursorY: number) => ({ cursorX, cursorY });

  it("takes the first candidate when there is nothing to compare against", () => {
    expect(
      resolveTerminalCursorFallback({
        candidate: pos(3, 2),
        previous: null,
        previousCellCursorLike: false,
        inputRecent: false,
        refreshDue: false,
      }),
    ).toEqual({ kind: "move", position: pos(3, 2) });
  });

  it("holds the previous position while a busy TUI flips its scan result", () => {
    // A spinner frame makes the scan resolve to a different cell than the
    // input cursor the user is not currently typing into.
    const previous = pos(3, 20);
    expect(
      resolveTerminalCursorFallback({
        candidate: pos(40, 2),
        previous,
        previousCellCursorLike: true,
        inputRecent: false,
        refreshDue: false,
      }),
    ).toEqual({ kind: "hold", position: previous });
  });

  it("holds, and does not hide, while the scan misses an isolated cell", () => {
    const previous = pos(3, 20);
    expect(
      resolveTerminalCursorFallback({
        candidate: null,
        previous,
        previousCellCursorLike: true,
        inputRecent: false,
        refreshDue: false,
      }),
    ).toEqual({ kind: "hold", position: previous });
  });

  it("hides once nothing on screen looks like a cursor anymore", () => {
    expect(
      resolveTerminalCursorFallback({
        candidate: null,
        previous: pos(3, 20),
        previousCellCursorLike: false,
        inputRecent: false,
        refreshDue: false,
      }),
    ).toEqual({ kind: "hide" });
  });

  it("follows the cursor when the previous cell stopped being one", () => {
    expect(
      resolveTerminalCursorFallback({
        candidate: pos(3, 21),
        previous: pos(3, 20),
        previousCellCursorLike: false,
        inputRecent: false,
        refreshDue: false,
      }),
    ).toEqual({ kind: "move", position: pos(3, 21) });
  });

  it("follows the cursor while the user is typing", () => {
    expect(
      resolveTerminalCursorFallback({
        candidate: pos(4, 20),
        previous: pos(3, 20),
        previousCellCursorLike: true,
        inputRecent: true,
        refreshDue: false,
      }),
    ).toEqual({ kind: "move", position: pos(4, 20) });
  });

  it("re-resolves a stale position even while idle", () => {
    expect(
      resolveTerminalCursorFallback({
        candidate: pos(9, 9),
        previous: pos(3, 20),
        previousCellCursorLike: true,
        inputRecent: false,
        refreshDue: true,
      }),
    ).toEqual({ kind: "move", position: pos(9, 9) });
  });

  it("treats an unchanged candidate as a hold", () => {
    expect(
      resolveTerminalCursorFallback({
        candidate: pos(3, 20),
        previous: pos(3, 20),
        previousCellCursorLike: true,
        inputRecent: false,
        refreshDue: true,
      }),
    ).toEqual({ kind: "hold", position: pos(3, 20) });
  });

  it("compares grid positions", () => {
    expect(isSameTerminalCursorGrid(null, pos(1, 1))).toBe(false);
    expect(isSameTerminalCursorGrid(pos(1, 1), pos(1, 1))).toBe(true);
    expect(isSameTerminalCursorGrid(pos(1, 1), pos(1, 2))).toBe(false);
  });
});

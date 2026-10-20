const TERMINAL_CURSOR_SMOOTH_CARET_ANIMATIONS = [
  "off",
  "explicit",
  "on",
] as const;

export type TerminalCursorSmoothCaretAnimation =
  (typeof TERMINAL_CURSOR_SMOOTH_CARET_ANIMATIONS)[number];

export type TerminalCursorGridPosition = {
  cursorX: number;
  cursorY: number;
};

export type TerminalCursorMotionInput = {
  preference: TerminalCursorSmoothCaretAnimation;
  previous: TerminalCursorGridPosition | null;
  next: TerminalCursorGridPosition;
  explicit: boolean;
  alternateScreen: boolean;
  composing: boolean;
  reducedMotion: boolean;
  suppressed: boolean;
};

export type TerminalCursorHiddenMotionInput = Omit<
  TerminalCursorMotionInput,
  "next"
>;

export const DEFAULT_TERMINAL_CURSOR_SMOOTH_CARET_ANIMATION: TerminalCursorSmoothCaretAnimation =
  "explicit";

export const TERMINAL_CURSOR_MOTION_INTENT_MS = 220;
export const TERMINAL_CURSOR_MOTION_SUPPRESS_MS = 220;
export const TERMINAL_CURSOR_MOTION_TRANSITION_MS = 72;
export const TERMINAL_CURSOR_MOTION_HIDDEN_GRACE_MS = 140;

// A hidden terminal cursor's position is only ever a guess derived from a
// per-frame screen scan, so a continuously redrawing TUI (a spinner, streaming
// output) would otherwise yank the overlay cursor around the screen at its own
// redraw cadence. Re-resolve this often enough to stay correct, rarely enough
// to stay still.
export const TERMINAL_CURSOR_FALLBACK_REFRESH_MS = 600;

const MAX_SMOOTH_CURSOR_DELTA_X = 5;
const MAX_SMOOTH_CURSOR_DELTA_Y = 1;
const LARGE_INPUT_CHAR_LIMIT = 8;

export function coerceTerminalCursorSmoothCaretAnimation(
  value: unknown,
): TerminalCursorSmoothCaretAnimation {
  return typeof value === "string" &&
    (TERMINAL_CURSOR_SMOOTH_CARET_ANIMATIONS as readonly string[]).includes(
      value,
    )
    ? (value as TerminalCursorSmoothCaretAnimation)
    : DEFAULT_TERMINAL_CURSOR_SMOOTH_CARET_ANIMATION;
}

export function shouldAnimateTerminalCursorMotion(
  input: TerminalCursorMotionInput,
): boolean {
  if (
    input.preference === "off" ||
    input.reducedMotion ||
    input.composing ||
    input.suppressed ||
    !input.previous
  ) {
    return false;
  }

  const dx = Math.abs(input.next.cursorX - input.previous.cursorX);
  const dy = Math.abs(input.next.cursorY - input.previous.cursorY);
  if (dx === 0 && dy === 0) return false;
  if (dx > MAX_SMOOTH_CURSOR_DELTA_X || dy > MAX_SMOOTH_CURSOR_DELTA_Y) {
    return false;
  }

  if (input.preference === "explicit") return input.explicit;

  // Full-screen TUIs update the grid continuously. Keep automatic smoothing
  // out of their redraw stream, while still allowing direct user movement.
  return input.explicit || !input.alternateScreen;
}

export function shouldHoldTerminalCursorMotionForHiddenCursor(
  input: TerminalCursorHiddenMotionInput,
): boolean {
  return (
    input.preference !== "off" &&
    !!input.previous &&
    input.explicit &&
    !input.alternateScreen &&
    !input.composing &&
    !input.reducedMotion &&
    !input.suppressed
  );
}

export function shouldSuppressCursorMotionForInput(data: string): boolean {
  if (data.includes("\x1b[200~") || data.includes("\x1b[201~")) return true;
  if (data.includes("\n")) return true;
  return [...data].length > LARGE_INPUT_CHAR_LIMIT;
}

export function isSameTerminalCursorGrid(
  a: TerminalCursorGridPosition | null,
  b: TerminalCursorGridPosition,
): boolean {
  return !!a && a.cursorX === b.cursorX && a.cursorY === b.cursorY;
}

/**
 * What the overlay cursor should do this frame when the terminal's own cursor
 * is hidden and its position is inferred from the screen.
 *
 * - `move`: trust the freshly scanned candidate.
 * - `hold`: keep showing the previous position. A redraw stream flips which
 *   cell looks cursor-like every frame; without a hold the overlay cursor
 *   darts across the screen and strobes as the scan resolves to different
 *   cells or to none at all.
 * - `hide`: nothing on screen looks like a cursor anymore.
 */
export type TerminalCursorFallbackDecision =
  | { kind: "move"; position: TerminalCursorGridPosition }
  | { kind: "hold"; position: TerminalCursorGridPosition }
  | { kind: "hide" };

export type TerminalCursorFallbackInput = {
  /** Best-effort cursor-like cell found this frame, if any. */
  candidate: TerminalCursorGridPosition | null;
  /** Position the overlay showed last frame, if any. */
  previous: TerminalCursorGridPosition | null;
  /** The previous position's cell still looks like a cursor. */
  previousCellCursorLike: boolean;
  /** The user typed or is composing input recently. */
  inputRecent: boolean;
  /** Enough time passed that a stale position should be re-resolved. */
  refreshDue: boolean;
};

export function resolveTerminalCursorFallback(
  input: TerminalCursorFallbackInput,
): TerminalCursorFallbackDecision {
  const { candidate, previous } = input;

  if (!candidate) {
    // The scan can miss a cursor that is still where we left it because a
    // neighbor lit up this frame and broke the isolation test. Keep showing
    // it instead of strobing the cursor off and back on.
    if (previous && input.previousCellCursorLike) {
      return { kind: "hold", position: previous };
    }
    return { kind: "hide" };
  }

  if (!previous) return { kind: "move", position: candidate };
  if (isSameTerminalCursorGrid(previous, candidate)) {
    return { kind: "hold", position: candidate };
  }
  // The old cursor cell stopped looking like one, so the TUI moved its cursor;
  // follow it instead of freezing the overlay at a stale spot.
  if (!input.previousCellCursorLike) return { kind: "move", position: candidate };
  // The user is typing: follow the input cursor so the overlay tracks input
  // without waiting for the periodic refresh.
  if (input.inputRecent) return { kind: "move", position: candidate };
  if (input.refreshDue) return { kind: "move", position: candidate };

  return { kind: "hold", position: previous };
}

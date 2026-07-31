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
export const TERMINAL_CURSOR_MOTION_TRANSITION_MS = 96;
export const TERMINAL_CURSOR_MOTION_HIDDEN_GRACE_MS = 140;

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

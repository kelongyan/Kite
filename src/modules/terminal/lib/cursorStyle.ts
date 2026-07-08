export const TERMINAL_CURSOR_SHAPES = ["bar", "block", "underline"] as const;
export type TerminalCursorShape = (typeof TERMINAL_CURSOR_SHAPES)[number];

export const TERMINAL_CURSOR_ANIMATIONS = [
  "steady",
  "blink",
  "smooth",
  "expand",
] as const;
export type TerminalCursorAnimation =
  (typeof TERMINAL_CURSOR_ANIMATIONS)[number];

export const TERMINAL_CURSOR_WIDTHS = [1, 2, 3, 4] as const;
export type TerminalCursorWidth = (typeof TERMINAL_CURSOR_WIDTHS)[number];
export type TerminalCursorRenderStrategy = "native" | "overlay";

export type TerminalCursorOverlayBoxInput = {
  shape: TerminalCursorShape;
  cursorWidth: TerminalCursorWidth;
  cols: number;
  rows: number;
  cursorX: number;
  cursorY: number;
  screenWidth: number;
  screenHeight: number;
};

export type TerminalCursorOverlayBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type TerminalCursorVisibilityState = {
  visible: boolean;
  tail: string;
};

export type TerminalCursorOverlayVisibilityInput = {
  strategy: TerminalCursorRenderStrategy;
  hasOwner: boolean;
  hasLiveLeaf: boolean;
  parked: boolean;
  focused: boolean;
  windowActive: boolean;
  cursorVisible: boolean;
  hostVisible: boolean;
};

export const DEFAULT_TERMINAL_CURSOR_SHAPE: TerminalCursorShape = "bar";
export const DEFAULT_TERMINAL_CURSOR_ANIMATION: TerminalCursorAnimation =
  "expand";
export const DEFAULT_TERMINAL_CURSOR_WIDTH: TerminalCursorWidth = 1;

export function coerceTerminalCursorShape(
  value: unknown,
): TerminalCursorShape {
  return typeof value === "string" &&
    (TERMINAL_CURSOR_SHAPES as readonly string[]).includes(value)
    ? (value as TerminalCursorShape)
    : DEFAULT_TERMINAL_CURSOR_SHAPE;
}

export function coerceTerminalCursorAnimation(
  value: unknown,
): TerminalCursorAnimation {
  return typeof value === "string" &&
    (TERMINAL_CURSOR_ANIMATIONS as readonly string[]).includes(value)
    ? (value as TerminalCursorAnimation)
    : DEFAULT_TERMINAL_CURSOR_ANIMATION;
}

export function coerceTerminalCursorWidth(
  value: unknown,
): TerminalCursorWidth {
  return typeof value === "number" &&
    (TERMINAL_CURSOR_WIDTHS as readonly number[]).includes(value)
    ? (value as TerminalCursorWidth)
    : DEFAULT_TERMINAL_CURSOR_WIDTH;
}

export function getTerminalCursorRenderStrategy(
  animation: TerminalCursorAnimation,
): TerminalCursorRenderStrategy {
  return animation === "smooth" || animation === "expand"
    ? "overlay"
    : "native";
}

export function shouldShowTerminalCursorOverlay(
  input: TerminalCursorOverlayVisibilityInput,
): boolean {
  return (
    input.strategy === "overlay" &&
    input.hasOwner &&
    input.hasLiveLeaf &&
    !input.parked &&
    input.focused &&
    input.windowActive &&
    input.cursorVisible &&
    input.hostVisible
  );
}

export function computeTerminalCursorOverlayBox(
  input: TerminalCursorOverlayBoxInput,
): TerminalCursorOverlayBox | null {
  if (
    input.cols <= 0 ||
    input.rows <= 0 ||
    input.screenWidth <= 0 ||
    input.screenHeight <= 0
  ) {
    return null;
  }

  const cellWidth = input.screenWidth / input.cols;
  const cellHeight = input.screenHeight / input.rows;
  if (
    !Number.isFinite(cellWidth) ||
    !Number.isFinite(cellHeight) ||
    cellWidth <= 0 ||
    cellHeight <= 0
  ) {
    return null;
  }

  const cursorX = clamp(Math.trunc(input.cursorX), 0, input.cols - 1);
  const cursorY = clamp(Math.trunc(input.cursorY), 0, input.rows - 1);
  const left = cursorX * cellWidth;
  const cellTop = cursorY * cellHeight;

  if (input.shape === "bar") {
    return {
      left,
      top: cellTop,
      width: Math.min(Math.max(1, input.cursorWidth), cellWidth),
      height: cellHeight,
    };
  }

  if (input.shape === "underline") {
    const height = Math.min(
      cellHeight,
      Math.max(2, Math.round(cellHeight * 0.12)),
    );
    return {
      left,
      top: cellTop + cellHeight - height,
      width: cellWidth,
      height,
    };
  }

  return {
    left,
    top: cellTop,
    width: cellWidth,
    height: cellHeight,
  };
}

export function resolveTerminalCursorVisibilityFromOutput(
  text: string,
  state: TerminalCursorVisibilityState,
): TerminalCursorVisibilityState {
  const combined = `${state.tail}${text}`;
  let visible = state.visible;
  const re = /\x1b\[\?([0-9;]*)([hl])/g;
  for (const match of combined.matchAll(re)) {
    const params = match[1].split(";");
    if (params.includes("25")) visible = match[2] === "h";
  }
  return {
    visible,
    tail: combined.slice(-32),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

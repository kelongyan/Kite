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

export type TerminalCursorMaskCell = {
  getChars(): string;
  getWidth(): number;
  getBgColor(): number;
  isBgDefault(): boolean;
  isBgPalette(): boolean;
  isBgRGB(): boolean;
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

export function coerceTerminalCursorShape(value: unknown): TerminalCursorShape {
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

export function coerceTerminalCursorWidth(value: unknown): TerminalCursorWidth {
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

export function shouldSuppressNativeCursor(
  animation: TerminalCursorAnimation,
): boolean {
  return getTerminalCursorRenderStrategy(animation) === "overlay";
}

export function resolveTerminalNativeCursorShape(
  animation: TerminalCursorAnimation,
  shape: TerminalCursorShape,
): TerminalCursorShape {
  return shouldSuppressNativeCursor(animation) ? "bar" : shape;
}

export function resolveTerminalNativeCursorWidth(
  animation: TerminalCursorAnimation,
  width: TerminalCursorWidth,
): TerminalCursorWidth {
  return shouldSuppressNativeCursor(animation) ? 1 : width;
}

export function shouldInterceptTerminalCursorColor(
  animation: TerminalCursorAnimation,
  data: string,
): boolean {
  return shouldSuppressNativeCursor(animation) && data.trim() !== "?";
}

export function shouldInterceptTerminalCursorStyle(
  animation: TerminalCursorAnimation,
): boolean {
  return shouldSuppressNativeCursor(animation);
}

const ANSI_BACKGROUND_VARS = [
  "--terminal-ansi-black",
  "--terminal-ansi-red",
  "--terminal-ansi-green",
  "--terminal-ansi-yellow",
  "--terminal-ansi-blue",
  "--terminal-ansi-magenta",
  "--terminal-ansi-cyan",
  "--terminal-ansi-white",
  "--terminal-ansi-bright-black",
  "--terminal-ansi-bright-red",
  "--terminal-ansi-bright-green",
  "--terminal-ansi-bright-yellow",
  "--terminal-ansi-bright-blue",
  "--terminal-ansi-bright-magenta",
  "--terminal-ansi-bright-cyan",
  "--terminal-ansi-bright-white",
] as const;

export function terminalCursorMaskColor(
  cell: TerminalCursorMaskCell | undefined,
  paletteColor?: (index: number) => string | null,
): string | null {
  if (!cell || cell.getWidth() <= 0) return null;
  const chars = cell.getChars();
  if (chars !== "" && chars !== " " && chars !== "\u00a0") return null;
  if (cell.isBgDefault()) return "var(--terminal-background)";
  if (cell.isBgRGB()) {
    const color = cell.getBgColor() & 0xffffff;
    return `rgb(${(color >> 16) & 0xff}, ${(color >> 8) & 0xff}, ${color & 0xff})`;
  }
  if (cell.isBgPalette()) {
    const index = cell.getBgColor();
    const resolved = paletteColor?.(index);
    if (resolved) return resolved;
    const variable = ANSI_BACKGROUND_VARS[index];
    return variable ? `var(${variable})` : null;
  }
  return null;
}

export function shouldShowTerminalCursorOverlay(
  input: TerminalCursorOverlayVisibilityInput,
): boolean {
  return (
    input.strategy === "overlay" &&
    input.hasOwner &&
    input.hasLiveLeaf &&
    input.cursorVisible &&
    !input.parked &&
    input.focused &&
    input.windowActive &&
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

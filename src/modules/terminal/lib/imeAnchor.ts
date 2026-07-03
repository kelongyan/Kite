import type { Terminal } from "@xterm/xterm";

export type ImeAnchorInput = {
  cols: number;
  rows: number;
  cursorX: number;
  cursorY: number;
  screenWidth: number;
  screenHeight: number;
};

export type ImeAnchor = {
  left: number;
  top: number;
  width: number;
  height: number;
  lineHeight: number;
};

export function computeImeAnchor(input: ImeAnchorInput): ImeAnchor | null {
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
  if (cellWidth <= 0 || cellHeight <= 0) return null;

  const cursorX = clamp(Math.trunc(input.cursorX), 0, input.cols - 1);
  const cursorY = clamp(Math.trunc(input.cursorY), 0, input.rows - 1);

  return {
    left: cursorX * cellWidth,
    top: cursorY * cellHeight,
    width: Math.max(cellWidth, 1),
    height: Math.max(cellHeight, 1),
    lineHeight: Math.max(cellHeight, 1),
  };
}

export function syncImeTextarea(
  textarea: HTMLTextAreaElement,
  input: ImeAnchorInput,
): boolean {
  const anchor = computeImeAnchor(input);
  if (!anchor) return false;

  textarea.style.left = `${anchor.left}px`;
  textarea.style.top = `${anchor.top}px`;
  textarea.style.width = `${anchor.width}px`;
  textarea.style.height = `${anchor.height}px`;
  textarea.style.lineHeight = `${anchor.lineHeight}px`;
  textarea.style.zIndex = "-5";
  return true;
}

export function syncTerminalImeAnchor(term: Terminal): boolean {
  const textarea = term.textarea;
  const screen = term.element?.querySelector<HTMLElement>(".xterm-screen");
  if (!textarea || !screen?.isConnected) return false;

  const width = dimensionFromStyleOrRect(screen, "width");
  const height = dimensionFromStyleOrRect(screen, "height");
  const buffer = term.buffer.active;

  return syncImeTextarea(textarea, {
    cols: term.cols,
    rows: term.rows,
    cursorX: buffer.cursorX,
    cursorY: buffer.cursorY,
    screenWidth: width,
    screenHeight: height,
  });
}

function dimensionFromStyleOrRect(
  element: HTMLElement,
  property: "width" | "height",
): number {
  const styled = Number.parseFloat(element.style[property]);
  if (Number.isFinite(styled) && styled > 0) return styled;
  const rect = element.getBoundingClientRect();
  return property === "width" ? rect.width : rect.height;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

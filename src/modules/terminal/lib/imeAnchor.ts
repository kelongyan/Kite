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

export type ImeCursor = {
  cursorX: number;
  cursorY: number;
};

export type VisibleCursorCell = ImeCursor & {
  inverse: boolean;
};

type ImeBufferCell = {
  getChars(): string;
  getWidth(): number;
  isInverse(): number;
  isBgDefault(): boolean;
  getBgColorMode(): number;
};

type ImeBufferLine = {
  length: number;
  getCell(index: number, cell?: ImeBufferCell): ImeBufferCell | undefined;
};

type ImeBuffer = {
  cursorX: number;
  cursorY: number;
  viewportY?: number;
  length: number;
  getLine(index: number): ImeBufferLine | undefined;
};

export type ImeCursorInput = {
  buffer: ImeBuffer;
  cols: number;
  rows: number;
  preferVisibleCursor?: boolean;
  requireInverse?: boolean;
};

export type ImeSyncOptions = {
  compositionView?: HTMLElement | null;
  fontFamily?: string;
  fontSize?: number;
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

export function resolveImeAnchorCursor(input: ImeCursorInput): ImeCursor {
  const fallback = {
    cursorX: clamp(Math.trunc(input.buffer.cursorX), 0, input.cols - 1),
    cursorY: clamp(Math.trunc(input.buffer.cursorY), 0, input.rows - 1),
  };

  if (!input.preferVisibleCursor) return fallback;

  const visibleCursor = findVisibleCursorCell(input);
  return visibleCursor
    ? { cursorX: visibleCursor.cursorX, cursorY: visibleCursor.cursorY }
    : fallback;
}

export function syncImeTextarea(
  textarea: HTMLTextAreaElement,
  input: ImeAnchorInput,
  options: ImeSyncOptions = {},
): boolean {
  const anchor = computeImeAnchor(input);
  if (!anchor) return false;

  textarea.style.left = `${anchor.left}px`;
  textarea.style.top = `${anchor.top}px`;
  textarea.style.width = `${anchor.width}px`;
  textarea.style.height = `${anchor.height}px`;
  textarea.style.lineHeight = `${anchor.lineHeight}px`;
  textarea.style.zIndex = "-5";

  const compositionView = options.compositionView;
  if (compositionView) {
    compositionView.style.left = `${anchor.left}px`;
    compositionView.style.top = `${anchor.top}px`;
    compositionView.style.height = `${anchor.height}px`;
    compositionView.style.lineHeight = `${anchor.lineHeight}px`;
    if (options.fontFamily)
      compositionView.style.fontFamily = options.fontFamily;
    if (options.fontSize)
      compositionView.style.fontSize = `${options.fontSize}px`;
  }

  return true;
}

export function syncTerminalImeAnchor(term: Terminal): boolean {
  const textarea = term.textarea;
  const screen = term.element?.querySelector<HTMLElement>(".xterm-screen");
  if (!textarea || !screen?.isConnected) return false;

  const width = dimensionFromStyleOrRect(screen, "width");
  const height = dimensionFromStyleOrRect(screen, "height");
  const buffer = term.buffer.active;
  const cursor = resolveImeAnchorCursor({
    buffer,
    cols: term.cols,
    rows: term.rows,
    preferVisibleCursor: isTerminalCursorHidden(term),
  });

  return syncImeTextarea(
    textarea,
    {
      cols: term.cols,
      rows: term.rows,
      cursorX: cursor.cursorX,
      cursorY: cursor.cursorY,
      screenWidth: width,
      screenHeight: height,
    },
    {
      compositionView:
        term.element?.querySelector<HTMLElement>(".composition-view") ?? null,
      fontFamily: term.options.fontFamily,
      fontSize: term.options.fontSize,
    },
  );
}

export function findVisibleCursorCell(
  input: ImeCursorInput,
): VisibleCursorCell | null {
  const viewportY = Math.max(0, Math.trunc(input.buffer.viewportY ?? 0));
  const rows = Math.max(0, input.rows);
  const cols = Math.max(0, input.cols);
  let inverseCandidate: VisibleCursorCell | null = null;
  let workCell: ImeBufferCell | undefined;

  for (let y = rows - 1; y >= 0; y--) {
    const line = input.buffer.getLine(viewportY + y);
    if (!line) continue;
    const maxX = Math.min(cols, line.length);
    for (let x = 0; x < maxX; x++) {
      const cell = line.getCell(x, workCell);
      if (!cell) continue;
      workCell = cell;
      if (!isCursorLikeBlankCell(cell)) continue;
      if (input.requireInverse && !cell.isInverse()) continue;
      if (
        isCursorLikeNeighbor(line, x - 1, input.requireInverse) ||
        isCursorLikeNeighbor(line, x + 1, input.requireInverse)
      ) {
        continue;
      }
      const candidate = {
        cursorX: x,
        cursorY: y,
        inverse: cell.isInverse() !== 0,
      };
      if (!input.requireInverse) return candidate;
      if (inverseCandidate) return null;
      inverseCandidate = candidate;
    }
  }

  return inverseCandidate;
}

function isCursorLikeBlankCell(cell: ImeBufferCell): boolean {
  if (cell.getWidth() <= 0) return false;
  const chars = cell.getChars();
  if (chars !== "" && chars !== " " && chars !== "\u00a0") return false;
  return isHighlightedCell(cell);
}

function isCursorLikeNeighbor(
  line: ImeBufferLine,
  index: number,
  requireInverse = false,
): boolean {
  if (index < 0 || index >= line.length) return false;
  const cell = line.getCell(index);
  if (requireInverse && !cell?.isInverse()) return false;
  return !!cell && isCursorLikeBlankCell(cell);
}

function isHighlightedCell(cell: ImeBufferCell): boolean {
  if (cell.isInverse()) return true;
  if (!cell.isBgDefault()) return true;
  return cell.getBgColorMode() !== 0;
}

function isTerminalCursorHidden(term: Terminal): boolean {
  const internal = term as unknown as {
    _core?: { coreService?: { isCursorHidden?: boolean } };
  };
  return internal._core?.coreService?.isCursorHidden === true;
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

import { describe, expect, it } from "vitest";

import {
  computeImeAnchor,
  resolveImeAnchorCursor,
  syncImeTextarea,
} from "./imeAnchor";

describe("computeImeAnchor", () => {
  it("places the IME anchor on the active cursor cell", () => {
    expect(
      computeImeAnchor({
        cols: 80,
        rows: 24,
        cursorX: 7,
        cursorY: 3,
        screenWidth: 800,
        screenHeight: 384,
      }),
    ).toEqual({
      left: 70,
      top: 48,
      width: 10,
      height: 16,
      lineHeight: 16,
    });
  });

  it("clamps cursor coordinates into the visible terminal grid", () => {
    expect(
      computeImeAnchor({
        cols: 80,
        rows: 24,
        cursorX: 80,
        cursorY: 30,
        screenWidth: 800,
        screenHeight: 384,
      }),
    ).toMatchObject({
      left: 790,
      top: 368,
    });
  });

  it("returns null when the terminal geometry cannot be measured", () => {
    expect(
      computeImeAnchor({
        cols: 80,
        rows: 24,
        cursorX: 1,
        cursorY: 1,
        screenWidth: 0,
        screenHeight: 384,
      }),
    ).toBeNull();
  });
});

describe("resolveImeAnchorCursor", () => {
  it("uses an isolated highlighted blank cell when a TUI hides the real cursor", () => {
    const buffer = createBuffer({
      cursorX: 28,
      cursorY: 12,
      lines: [
        "Claude Code",
        "",
        "----------------------------------------",
        [{ chars: ">" }, { chars: " " }, cursorCell(), { chars: " " }],
        "? for shortcuts",
        "x Auto-update failed",
      ],
    });

    expect(
      resolveImeAnchorCursor({
        buffer,
        cols: 40,
        rows: 6,
        preferVisibleCursor: true,
      }),
    ).toEqual({ cursorX: 2, cursorY: 3 });
  });

  it("falls back to the terminal cursor when no TUI cursor cell is visible", () => {
    const buffer = createBuffer({
      cursorX: 28,
      cursorY: 12,
      lines: ["plain shell", "", "? for shortcuts"],
    });

    expect(
      resolveImeAnchorCursor({
        buffer,
        cols: 40,
        rows: 6,
        preferVisibleCursor: true,
      }),
    ).toEqual({ cursorX: 28, cursorY: 5 });
  });
});

describe("syncImeTextarea", () => {
  it("updates the xterm helper textarea without making it visible", () => {
    const style: Partial<CSSStyleDeclaration> = {};
    const textarea = { style } as HTMLTextAreaElement;

    const didSync = syncImeTextarea(textarea, {
      cols: 80,
      rows: 24,
      cursorX: 2,
      cursorY: 1,
      screenWidth: 800,
      screenHeight: 384,
    });

    expect(didSync).toBe(true);
    expect(textarea.style.left).toBe("20px");
    expect(textarea.style.top).toBe("16px");
    expect(textarea.style.width).toBe("10px");
    expect(textarea.style.height).toBe("16px");
    expect(textarea.style.lineHeight).toBe("16px");
    expect(textarea.style.zIndex).toBe("-5");
    expect(textarea.style.opacity).toBeUndefined();
  });

  it("keeps the xterm composition view aligned with the hidden textarea", () => {
    const textarea = { style: {} } as HTMLTextAreaElement;
    const compositionView = { style: {} } as HTMLElement;

    const didSync = syncImeTextarea(
      textarea,
      {
        cols: 80,
        rows: 24,
        cursorX: 2,
        cursorY: 1,
        screenWidth: 800,
        screenHeight: 384,
      },
      { compositionView, fontFamily: "JetBrains Mono", fontSize: 13 },
    );

    expect(didSync).toBe(true);
    expect(compositionView.style.left).toBe("20px");
    expect(compositionView.style.top).toBe("16px");
    expect(compositionView.style.height).toBe("16px");
    expect(compositionView.style.lineHeight).toBe("16px");
    expect(compositionView.style.fontFamily).toBe("JetBrains Mono");
    expect(compositionView.style.fontSize).toBe("13px");
  });
});

type TestCell = {
  chars?: string;
  inverse?: boolean;
  bgDefault?: boolean;
};

type TestLine = string | TestCell[];

function createBuffer(input: {
  cursorX: number;
  cursorY: number;
  lines: TestLine[];
}) {
  const lines = input.lines.map(createLine);
  return {
    cursorX: input.cursorX,
    cursorY: input.cursorY,
    viewportY: 0,
    length: lines.length,
    getLine: (index: number) => lines[index],
  };
}

function createLine(input: TestLine) {
  const cells: TestCell[] =
    typeof input === "string"
      ? Array.from(input).map((chars) => ({ chars }))
      : input;
  return {
    length: cells.length,
    getCell: (index: number) => {
      const cell = cells[index] ?? { chars: "" };
      return {
        getChars: () => cell.chars ?? "",
        getWidth: () => 1,
        isInverse: () => (cell.inverse ? 1 : 0),
        isBgDefault: () => cell.bgDefault !== false,
        getBgColorMode: () => (cell.bgDefault === false ? 1 : 0),
      };
    },
  };
}

function cursorCell(): TestCell {
  return { chars: " ", inverse: true };
}

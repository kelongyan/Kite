import { describe, expect, it } from "vitest";
import {
  computeImeAnchor,
  findVisibleCursorCell,
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
        cursorHidden: true,
      }),
    ).toEqual({ cursorX: 2, cursorY: 3 });
  });

  it("uses a non-blank inverse TUI cursor when the PTY cursor is hidden", () => {
    const buffer = createBuffer({
      cursorX: 35,
      cursorY: 5,
      lines: [
        "Agent CLI",
        [
          { chars: ">" },
          { chars: " " },
          { chars: "中", inverse: true },
          { chars: " " },
        ],
      ],
    });

    expect(
      resolveImeAnchorCursor({
        buffer,
        cols: 40,
        rows: 6,
        cursorHidden: true,
      }),
    ).toEqual({ cursorX: 2, cursorY: 1 });
  });

  it("keeps a visible PTY cursor when output contains an inverse cell", () => {
    const buffer = createBuffer({
      cursorX: 8,
      cursorY: 5,
      lines: [
        [{ chars: "x", inverse: true }, { chars: " " }],
        "plain shell prompt",
      ],
    });

    expect(
      resolveImeAnchorCursor({
        buffer,
        cols: 40,
        rows: 6,
        cursorHidden: false,
      }),
    ).toEqual({ cursorX: 8, cursorY: 5 });
  });

  it("identifies an inverse blank cell as a synthetic TUI cursor", () => {
    const buffer = createBuffer({
      cursorX: 28,
      cursorY: 12,
      lines: [
        "Claude Code",
        [{ chars: ">" }, { chars: " " }, cursorCell(), { chars: " " }],
        "? for shortcuts",
      ],
    });

    expect(
      findVisibleCursorCell({
        buffer,
        cols: 40,
        rows: 3,
      }),
    ).toEqual({ cursorX: 2, cursorY: 1, inverse: true });
  });

  it("skips background highlights when an inverse cursor is required", () => {
    const buffer = createBuffer({
      cursorX: 28,
      cursorY: 12,
      lines: [
        [{ chars: ">" }, cursorCell(), { chars: " ", bgDefault: false }],
        [{ chars: " " }, { chars: " ", bgDefault: false }],
      ],
    });

    expect(
      findVisibleCursorCell({
        buffer,
        cols: 40,
        rows: 2,
        requireInverse: true,
      }),
    ).toEqual({ cursorX: 1, cursorY: 0, inverse: true });
  });

  it("rejects ambiguous inverse cursor candidates", () => {
    const buffer = createBuffer({
      cursorX: 28,
      cursorY: 12,
      lines: [
        [{ chars: ">" }, cursorCell()],
        [{ chars: "status" }, cursorCell()],
      ],
    });

    expect(
      findVisibleCursorCell({
        buffer,
        cols: 40,
        rows: 2,
        requireInverse: true,
      }),
    ).toBeNull();
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
        cursorHidden: true,
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

  it("publishes a pinned anchor for the active composition CSS", () => {
    const properties = new Map<string, string>();
    const root = {
      style: {
        setProperty: (name: string, value: string) => {
          properties.set(name, value);
        },
      },
    } as HTMLElement;
    const textarea = { style: {} } as HTMLTextAreaElement;

    syncImeTextarea(
      textarea,
      {
        cols: 80,
        rows: 24,
        cursorX: 2,
        cursorY: 1,
        screenWidth: 800,
        screenHeight: 384,
      },
      { root },
    );

    expect(Object.fromEntries(properties)).toEqual({
      "--kite-ime-left": "20px",
      "--kite-ime-top": "16px",
      "--kite-ime-width": "10px",
      "--kite-ime-height": "16px",
      "--kite-ime-line-height": "16px",
    });
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

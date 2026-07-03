import { describe, expect, it } from "vitest";

import { computeImeAnchor, syncImeTextarea } from "./imeAnchor";

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
});

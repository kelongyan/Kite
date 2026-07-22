import { describe, expect, it } from "vitest";

import {
  computeTerminalCursorOverlayBox,
  coerceTerminalCursorAnimation,
  coerceTerminalCursorShape,
  coerceTerminalCursorWidth,
  DEFAULT_TERMINAL_CURSOR_WIDTH,
  getTerminalCursorRenderStrategy,
  resolveTerminalNativeCursorShape,
  resolveTerminalNativeCursorWidth,
  shouldInterceptTerminalCursorColor,
  shouldInterceptTerminalCursorStyle,
  shouldShowTerminalCursorOverlay,
  shouldSuppressNativeCursor,
  terminalCursorMaskColor,
} from "./cursorStyle";

describe("terminal cursor style preferences", () => {
  it("keeps supported cursor shapes", () => {
    expect(coerceTerminalCursorShape("bar")).toBe("bar");
    expect(coerceTerminalCursorShape("block")).toBe("block");
    expect(coerceTerminalCursorShape("underline")).toBe("underline");
  });

  it("falls back to bar for unsupported cursor shapes", () => {
    expect(coerceTerminalCursorShape("beam")).toBe("bar");
    expect(coerceTerminalCursorShape("")).toBe("bar");
    expect(coerceTerminalCursorShape(undefined)).toBe("bar");
  });

  it("keeps supported cursor animations", () => {
    expect(coerceTerminalCursorAnimation("steady")).toBe("steady");
    expect(coerceTerminalCursorAnimation("blink")).toBe("blink");
    expect(coerceTerminalCursorAnimation("smooth")).toBe("smooth");
    expect(coerceTerminalCursorAnimation("expand")).toBe("expand");
  });

  it("falls back to expand for unsupported cursor animations", () => {
    expect(coerceTerminalCursorAnimation("flash")).toBe("expand");
    expect(coerceTerminalCursorAnimation("")).toBe("expand");
    expect(coerceTerminalCursorAnimation(undefined)).toBe("expand");
  });

  it("keeps supported cursor widths", () => {
    expect(coerceTerminalCursorWidth(1)).toBe(1);
    expect(coerceTerminalCursorWidth(2)).toBe(2);
    expect(coerceTerminalCursorWidth(3)).toBe(3);
    expect(coerceTerminalCursorWidth(4)).toBe(4);
  });

  it("falls back to the default for unsupported cursor widths", () => {
    expect(coerceTerminalCursorWidth(0)).toBe(DEFAULT_TERMINAL_CURSOR_WIDTH);
    expect(coerceTerminalCursorWidth(5)).toBe(DEFAULT_TERMINAL_CURSOR_WIDTH);
    expect(coerceTerminalCursorWidth(2.5)).toBe(
      DEFAULT_TERMINAL_CURSOR_WIDTH,
    );
    expect(coerceTerminalCursorWidth(Number.NaN)).toBe(
      DEFAULT_TERMINAL_CURSOR_WIDTH,
    );
    expect(coerceTerminalCursorWidth(undefined)).toBe(
      DEFAULT_TERMINAL_CURSOR_WIDTH,
    );
  });

  it("uses native xterm rendering for steady and blink animations", () => {
    expect(getTerminalCursorRenderStrategy("steady")).toBe("native");
    expect(getTerminalCursorRenderStrategy("blink")).toBe("native");
  });

  it("uses overlay rendering for smooth and expand animations", () => {
    expect(getTerminalCursorRenderStrategy("smooth")).toBe("overlay");
    expect(getTerminalCursorRenderStrategy("expand")).toBe("overlay");
  });

  it("suppresses the xterm native cursor behind overlay animations", () => {
    expect(shouldSuppressNativeCursor("expand")).toBe(true);
    expect(shouldSuppressNativeCursor("smooth")).toBe(true);
    expect(shouldSuppressNativeCursor("blink")).toBe(false);
    expect(shouldSuppressNativeCursor("steady")).toBe(false);
  });

  it("keeps the suppressed native cursor to a one-pixel bar", () => {
    expect(resolveTerminalNativeCursorShape("expand", "block")).toBe("bar");
    expect(resolveTerminalNativeCursorWidth("smooth", 4)).toBe(1);
    expect(resolveTerminalNativeCursorShape("steady", "underline")).toBe(
      "underline",
    );
    expect(resolveTerminalNativeCursorWidth("blink", 3)).toBe(3);
  });

  it("intercepts TUI cursor overrides only while an overlay owns rendering", () => {
    expect(shouldInterceptTerminalCursorColor("expand", "#f8f8f2")).toBe(true);
    expect(shouldInterceptTerminalCursorColor("expand", "?")).toBe(false);
    expect(shouldInterceptTerminalCursorColor("steady", "#f8f8f2")).toBe(false);
    expect(shouldInterceptTerminalCursorStyle("smooth")).toBe(true);
    expect(shouldInterceptTerminalCursorStyle("blink")).toBe(false);
  });

  it("resolves a safe mask color for blank cursor cells", () => {
    expect(terminalCursorMaskColor(cursorMaskCell())).toBe(
      "var(--terminal-background)",
    );
    expect(
      terminalCursorMaskColor(
        cursorMaskCell({ bgDefault: false, bgRgb: true, bgColor: 0x44475a }),
      ),
    ).toBe("rgb(68, 71, 90)");
    expect(
      terminalCursorMaskColor(
        cursorMaskCell({ bgDefault: false, bgPalette: true, bgColor: 4 }),
      ),
    ).toBe("var(--terminal-ansi-blue)");
    expect(
      terminalCursorMaskColor(
        cursorMaskCell({ bgDefault: false, bgPalette: true, bgColor: 231 }),
        (index) => (index === 231 ? "rgb(255, 255, 255)" : null),
      ),
    ).toBe("rgb(255, 255, 255)");
    expect(terminalCursorMaskColor(cursorMaskCell({ chars: "x" }))).toBeNull();
  });

  it("shows the overlay cursor only for a focused visible live leaf", () => {
    expect(
      shouldShowTerminalCursorOverlay({
        strategy: "overlay",
        hasOwner: true,
        hasLiveLeaf: true,
        parked: false,
        focused: true,
        windowActive: true,
        cursorVisible: true,
        hostVisible: true,
      }),
    ).toBe(true);
  });

  it("hides the overlay cursor for inactive or hidden terminal slots", () => {
    const visible = {
      strategy: "overlay" as const,
      hasOwner: true,
      hasLiveLeaf: true,
      parked: false,
      focused: true,
      windowActive: true,
      cursorVisible: true,
      hostVisible: true,
    };

    expect(
      shouldShowTerminalCursorOverlay({ ...visible, strategy: "native" }),
    ).toBe(false);
    expect(
      shouldShowTerminalCursorOverlay({ ...visible, hasOwner: false }),
    ).toBe(false);
    expect(
      shouldShowTerminalCursorOverlay({ ...visible, hasLiveLeaf: false }),
    ).toBe(false);
    expect(shouldShowTerminalCursorOverlay({ ...visible, parked: true })).toBe(
      false,
    );
    expect(
      shouldShowTerminalCursorOverlay({ ...visible, focused: false }),
    ).toBe(false);
    expect(
      shouldShowTerminalCursorOverlay({ ...visible, windowActive: false }),
    ).toBe(false);
    expect(
      shouldShowTerminalCursorOverlay({ ...visible, cursorVisible: false }),
    ).toBe(false);
    expect(
      shouldShowTerminalCursorOverlay({ ...visible, hostVisible: false }),
    ).toBe(false);
  });

  it("hides the overlay when neither a native nor synthetic cursor is visible", () => {
    expect(
      shouldShowTerminalCursorOverlay({
        strategy: "overlay",
        hasOwner: true,
        hasLiveLeaf: true,
        parked: false,
        focused: true,
        windowActive: true,
        cursorVisible: false,
        hostVisible: true,
      }),
    ).toBe(false);
  });

  it("computes a bar overlay box from cursor cell metrics", () => {
    expect(
      computeTerminalCursorOverlayBox({
        shape: "bar",
        cursorWidth: 3,
        cols: 10,
        rows: 5,
        cursorX: 2,
        cursorY: 3,
        screenWidth: 100,
        screenHeight: 80,
      }),
    ).toEqual({
      left: 20,
      top: 48,
      width: 3,
      height: 16,
    });
  });

  it("computes block and underline overlay boxes", () => {
    expect(
      computeTerminalCursorOverlayBox({
        shape: "block",
        cursorWidth: 1,
        cols: 10,
        rows: 5,
        cursorX: 9,
        cursorY: 4,
        screenWidth: 100,
        screenHeight: 80,
      }),
    ).toEqual({
      left: 90,
      top: 64,
      width: 10,
      height: 16,
    });

    expect(
      computeTerminalCursorOverlayBox({
        shape: "underline",
        cursorWidth: 1,
        cols: 10,
        rows: 5,
        cursorX: 1,
        cursorY: 2,
        screenWidth: 100,
        screenHeight: 80,
      }),
    ).toEqual({
      left: 10,
      top: 46,
      width: 10,
      height: 2,
    });
  });

  it("clamps overlay cursor coordinates to the screen", () => {
    expect(
      computeTerminalCursorOverlayBox({
        shape: "block",
        cursorWidth: 1,
        cols: 10,
        rows: 5,
        cursorX: 99,
        cursorY: -1,
        screenWidth: 100,
        screenHeight: 80,
      }),
    ).toEqual({
      left: 90,
      top: 0,
      width: 10,
      height: 16,
    });
  });

  it("does not compute overlay boxes for invalid terminal dimensions", () => {
    expect(
      computeTerminalCursorOverlayBox({
        shape: "bar",
        cursorWidth: 1,
        cols: 0,
        rows: 5,
        cursorX: 0,
        cursorY: 0,
        screenWidth: 100,
        screenHeight: 80,
      }),
    ).toBeNull();
  });
});

function cursorMaskCell(
  input: {
    chars?: string;
    bgDefault?: boolean;
    bgRgb?: boolean;
    bgPalette?: boolean;
    bgColor?: number;
  } = {},
) {
  return {
    getChars: () => input.chars ?? " ",
    getWidth: () => 1,
    getBgColor: () => input.bgColor ?? 0,
    isBgDefault: () => input.bgDefault !== false,
    isBgPalette: () => input.bgPalette === true,
    isBgRGB: () => input.bgRgb === true,
  };
}

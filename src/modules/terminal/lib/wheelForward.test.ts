import { describe, expect, it } from "vitest";
import { resolveWheelForward } from "./wheelForward";

describe("resolveWheelForward", () => {
  const base = {
    mouseTrackingMode: "drag" as const,
    alternateScreen: true,
    deltaY: -100,
    shiftKey: false,
    col: 10,
    row: 5,
  };

  it("forwards wheel up as SGR button 64", () => {
    expect(resolveWheelForward({ ...base, deltaY: -100 })).toBe(
      "\x1b[<64;10;5M",
    );
  });

  it("forwards wheel down as SGR button 65", () => {
    expect(resolveWheelForward({ ...base, deltaY: 100 })).toBe(
      "\x1b[<65;10;5M",
    );
  });

  it.each([
    "none",
    "x10",
  ] as const)("keeps normal-buffer scrollback local with %s tracking", (mouseTrackingMode) => {
    expect(
      resolveWheelForward({
        ...base,
        mouseTrackingMode,
        alternateScreen: false,
      }),
    ).toBeNull();
  });

  it.each([
    "none",
    "x10",
  ] as const)("pages alternate-screen output with %s tracking instead of recalling input history", (mouseTrackingMode) => {
    expect(resolveWheelForward({ ...base, mouseTrackingMode })).toBe("\x1b[5~");
    expect(
      resolveWheelForward({ ...base, mouseTrackingMode, deltaY: 100 }),
    ).toBe("\x1b[6~");
  });

  it("defers to xterm for Shift+wheel (local scroll override)", () => {
    expect(resolveWheelForward({ ...base, shiftKey: true })).toBeNull();
  });

  it("ignores a horizontal-only wheel (deltaY 0)", () => {
    expect(resolveWheelForward({ ...base, deltaY: 0 })).toBeNull();
  });

  it("ignores non-finite deltas", () => {
    expect(resolveWheelForward({ ...base, deltaY: Number.NaN })).toBeNull();
  });

  it("forwards for every wheel tracking mode", () => {
    for (const mode of ["vt200", "drag", "any"] as const) {
      expect(resolveWheelForward({ ...base, mouseTrackingMode: mode })).toBe(
        "\x1b[<64;10;5M",
      );
    }
  });

  it("clamps out-of-range cells to a valid 1-based coordinate", () => {
    expect(resolveWheelForward({ ...base, col: 0, row: -3 })).toBe(
      "\x1b[<64;1;1M",
    );
  });
});

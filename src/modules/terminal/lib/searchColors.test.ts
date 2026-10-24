import { describe, expect, it } from "vitest";
import {
  buildSearchDecorationColors,
  cssColorToHex,
  mixHex,
  oklchToHex,
} from "./searchColors";

describe("cssColorToHex", () => {
  it("normalizes rgb() colors from computed styles", () => {
    expect(cssColorToHex("rgb(255, 0, 16)")).toBe("#ff0010");
    expect(cssColorToHex("rgba(0, 128, 255, 0.5)")).toBe("#0080ff");
  });

  it("passes through and lowercases 6-digit hex", () => {
    expect(cssColorToHex("#FF0010")).toBe("#ff0010");
  });

  it("converts oklch theme tokens to hex", () => {
    expect(cssColorToHex("oklch(1 0 0)")).toBe("#ffffff");
    expect(cssColorToHex("oklch(0 0 0)")).toBe("#000000");
    // Kite's light-theme selection token: a near-white color.
    expect(cssColorToHex("oklch(0.963 0.002 197.1)")).toMatch(/^#[0-9a-f]{6}$/);
    // Alpha component is accepted and ignored.
    expect(cssColorToHex("oklch(0.5 0.1 30 / 0.4)")).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("rejects formats it cannot normalize", () => {
    expect(cssColorToHex("")).toBeNull();
    expect(cssColorToHex("red")).toBeNull();
  });
});

describe("oklchToHex", () => {
  it("clamps out-of-gamut chroma instead of wrapping", () => {
    expect(oklchToHex(0.5, 0.4, 30)).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("returns black for unparseable numbers", () => {
    expect(oklchToHex("x", "0", "0")).toBe("#000000");
  });
});

describe("mixHex", () => {
  it("blends two colors at the given ratio", () => {
    expect(mixHex("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mixHex("#000000", "#ffffff", 0)).toBe("#000000");
    expect(mixHex("#000000", "#ffffff", 1)).toBe("#ffffff");
  });
});

describe("buildSearchDecorationColors", () => {
  it("builds muted match colors and selection-colored active matches", () => {
    const colors = buildSearchDecorationColors(
      "rgb(120, 120, 120)",
      "rgb(0, 0, 0)",
    );
    expect(colors.activeMatchBackground).toBe("#787878");
    expect(colors.matchBackground).toBe("#3c3c3c");
  });

  it("falls back to the raw selection color when tokens cannot be converted", () => {
    const colors = buildSearchDecorationColors("hotpink", "red");
    expect(colors.activeMatchBackground).toBe("hotpink");
    expect(colors.matchBackground).toBe("hotpink");
  });
});

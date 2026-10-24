import { describe, expect, it } from "vitest";
import {
  coerceFontWeight,
  DEFAULT_PREFERENCES,
  normalizeTerminalFontFamily,
} from "./store";

describe("coerceFontWeight", () => {
  it("keeps supported weights", () => {
    for (const w of ["normal", "500", "600", "bold"]) {
      expect(coerceFontWeight(w)).toBe(w);
    }
  });

  it("trims surrounding whitespace", () => {
    expect(coerceFontWeight("  bold  ")).toBe("bold");
  });

  it("falls back to normal for unsupported or empty values", () => {
    expect(coerceFontWeight("")).toBe("normal");
    expect(coerceFontWeight("900")).toBe("normal");
    expect(coerceFontWeight("heavy")).toBe("normal");
  });
});

describe("default terminal font", () => {
  it("uses the bundled Kite Mono family as the visible default", () => {
    expect(DEFAULT_PREFERENCES.terminalFontFamily).toBe("Kite Mono");
  });

  it("falls back to the bundled default only for a blank value", () => {
    expect(normalizeTerminalFontFamily("")).toBe("Kite Mono");
    expect(normalizeTerminalFontFamily("  ")).toBe("Kite Mono");
    expect(normalizeTerminalFontFamily(undefined)).toBe("Kite Mono");
  });

  it("keeps a real installed family that shares a legacy default's name", () => {
    // "Monaco" was the pre-v1 default, but it is also a family a user can
    // install. The retired-value rewrite lives in splitLegacyFontFamily so it
    // runs once during migration, not on every commit.
    expect(normalizeTerminalFontFamily("Monaco")).toBe("Monaco");
    expect(normalizeTerminalFontFamily(" monaco ")).toBe("monaco");
  });

  it("keeps an explicit custom terminal font", () => {
    expect(normalizeTerminalFontFamily("Fira Code")).toBe("Fira Code");
  });
});

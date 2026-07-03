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
  it("uses JetBrains Mono as the visible default", () => {
    expect(DEFAULT_PREFERENCES.terminalFontFamily).toBe("JetBrains Mono");
  });

  it("migrates blank and Monaco legacy values to JetBrains Mono", () => {
    expect(normalizeTerminalFontFamily("")).toBe("JetBrains Mono");
    expect(normalizeTerminalFontFamily("  ")).toBe("JetBrains Mono");
    expect(normalizeTerminalFontFamily("Monaco")).toBe("JetBrains Mono");
  });

  it("keeps an explicit custom terminal font", () => {
    expect(normalizeTerminalFontFamily("Fira Code")).toBe("Fira Code");
  });
});

import { describe, expect, it } from "vitest";
import { getDefaultTheme, listBuiltinThemes } from "./themes";
import { DEFAULT_THEME_ID, type ThemeVariant } from "./types";
import { validateTheme } from "./validateTheme";

const HEX_RE = /^#[0-9a-f]{6}$/i;
const RGBA_RE =
  /^rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(?:0|1|0?\.\d+)\s*\)$/i;

// Colors land in CSS variables and in the xterm theme object untouched, so a
// typo would silently render as an invalid value. Assert the literal shape.
function isColor(value: string): boolean {
  return HEX_RE.test(value) || RGBA_RE.test(value);
}

describe("builtin themes", () => {
  const themes = listBuiltinThemes();

  it("keeps ids unique and structurally valid", () => {
    const ids = themes.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const theme of themes) {
      const result = validateTheme({ ...theme });
      expect(
        result.ok,
        result.ok ? undefined : `${theme.id}: ${result.error}`,
      ).toBe(true);
    }
  });

  it("resolves the default theme from the shipped list", () => {
    expect(getDefaultTheme().id).toBe(DEFAULT_THEME_ID);
  });

  it("uses parseable colors everywhere", () => {
    for (const theme of themes) {
      for (const [mode, variant] of Object.entries(theme.variants) as [
        string,
        ThemeVariant,
      ][]) {
        const where = `${theme.id}.${mode}`;

        for (const [key, value] of Object.entries(variant.colors ?? {})) {
          // `radius` is the one non-color entry: it carries a CSS length.
          if (key === "radius") continue;
          expect(isColor(value), `${where}.colors.${key} = ${value}`).toBe(
            true,
          );
        }

        const terminal = variant.terminal;
        if (!terminal) continue;
        for (const key of ["background", "foreground", "cursor", "cursorAccent", "selection"] as const) {
          const value = terminal[key];
          if (value === undefined) continue;
          expect(isColor(value), `${where}.terminal.${key} = ${value}`).toBe(
            true,
          );
        }
        expect(terminal.ansi, `${where}.terminal.ansi`).toHaveLength(16);
        for (const [index, value] of (terminal.ansi ?? []).entries()) {
          expect(isColor(value), `${where}.terminal.ansi[${index}] = ${value}`).toBe(
            true,
          );
        }
      }
    }
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  detectMonoFontFamily,
  isFontAvailable,
  resolveFontFamily,
  splitLegacyFontFamily,
} from "./fonts";

const FALLBACK =
  '"Sarasa Mono SC", "Sarasa Term SC", "Source Han Mono SC", "Source Han Sans SC", "LXGW WenKai Mono", "LXGW WenKai", "Noto Sans Mono CJK SC", "Noto Serif CJK SC", "Noto Sans SC", "Noto Serif SC", "Microsoft YaHei Mono", "Microsoft YaHei", "Microsoft YaHei UI", "DengXian", "SimHei", "SimSun", "FangSong", "KaiTi", "NSimSun", "SFMono-Regular", "Menlo", monospace';
const DEFAULT_STACK = `"JetBrains Mono", ${FALLBACK}`;

function withoutFallbackFamilies(...families: string[]): string {
  const removed = new Set(families.map((family) => family.toLowerCase()));
  return FALLBACK.split(", ")
    .filter((family) => !removed.has(family.replace(/"/g, "").toLowerCase()))
    .join(", ");
}

describe("resolveFontFamily", () => {
  it("uses the bundled mono font before explicit CJK fallbacks", () => {
    expect(resolveFontFamily("JetBrainsMono Nerd Font", "Microsoft YaHei")).toBe(
      `"JetBrainsMono Nerd Font", "JetBrains Mono", "Microsoft YaHei", ${withoutFallbackFamilies("Microsoft YaHei")}`,
    );
  });

  it("uses the bundled mono font before automatic CJK fallbacks", () => {
    expect(resolveFontFamily("Fira Code", "")).toBe(
      `"Fira Code", "JetBrains Mono", ${FALLBACK}`,
    );
  });

  it("cleans quotes and trims both font inputs", () => {
    expect(resolveFontFamily('  "Fira Code"  ', " 'SimSun' ")).toBe(
      `"Fira Code", "JetBrains Mono", "SimSun", ${withoutFallbackFamilies("SimSun")}`,
    );
  });

  it("accepts comma-separated advanced stacks and removes duplicates", () => {
    expect(resolveFontFamily("Foo, monospace", "Microsoft YaHei")).toBe(
      `"Foo", monospace, "JetBrains Mono", "Microsoft YaHei", ${FALLBACK.replace(
        ", \"Microsoft YaHei\"",
        "",
      ).replace(", monospace", "")}`,
    );
  });

  it("strips stray internal quotes to avoid malformed tokens", () => {
    expect(resolveFontFamily('Foo"Bar', "")).toBe(
      `"FooBar", "JetBrains Mono", ${FALLBACK}`,
    );
  });

  it("uses the default stack for empty code input", () => {
    expect(resolveFontFamily("", "")).toBe(DEFAULT_STACK);
    expect(resolveFontFamily("   ", "   ")).toBe(DEFAULT_STACK);
  });

  it("returns the default stack from detectMonoFontFamily", () => {
    expect(detectMonoFontFamily()).toBe(DEFAULT_STACK);
  });
});

describe("splitLegacyFontFamily", () => {
  it("keeps a single code font and enables automatic CJK fallback", () => {
    expect(splitLegacyFontFamily("Fira Code")).toEqual({
      codeFontFamily: "Fira Code",
      cjkFontFamily: "",
    });
  });

  it("splits the former recommended font stack", () => {
    expect(
      splitLegacyFontFamily("JetBrains Mono, 'Microsoft YaHei', monospace"),
    ).toEqual({
      codeFontFamily: "JetBrains Mono",
      cjkFontFamily: "Microsoft YaHei",
    });
  });

  it("preserves an ambiguous advanced stack without losing data", () => {
    expect(splitLegacyFontFamily("Foo, Bar, monospace")).toEqual({
      codeFontFamily: "Foo, Bar, monospace",
      cjkFontFamily: "",
    });
    expect(
      splitLegacyFontFamily("Foo, Bar, 'Microsoft YaHei', monospace"),
    ).toEqual({
      codeFontFamily: "Foo, Bar, 'Microsoft YaHei', monospace",
      cjkFontFamily: "",
    });
  });

  it("normalizes empty and retired default values", () => {
    expect(splitLegacyFontFamily("")).toEqual({
      codeFontFamily: "JetBrains Mono",
      cjkFontFamily: "",
    });
    expect(splitLegacyFontFamily("Monaco")).toEqual({
      codeFontFamily: "JetBrains Mono",
      cjkFontFamily: "",
    });
  });
});

describe("isFontAvailable", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubDocument(fontFamilies: string[], canvasContext: unknown) {
    vi.stubGlobal("document", {
      fonts: fontFamilies.map((family) => ({ family })),
      createElement: () => ({ getContext: () => canvasContext }),
    });
  }

  // Every baseline measures the same width, so a canvas probe reports "missing".
  const blankCanvas = { measureText: () => ({ width: 100 }), font: "" };

  it("treats a family the app bundles via @font-face as available", () => {
    // The declared face shadows the system install, so a canvas probe measures
    // the (possibly unloaded) web font and wrongly reports it missing.
    stubDocument(['"JetBrains Mono"', "Inter Variable"], blankCanvas);

    expect(isFontAvailable("JetBrains Mono")).toBe(true);
    expect(isFontAvailable("  'jetbrains mono'  ")).toBe(true);
    expect(isFontAvailable("Inter Variable")).toBe(true);
  });

  it("does not claim a family that is neither bundled nor installed", () => {
    stubDocument(['"JetBrains Mono"'], blankCanvas);

    expect(isFontAvailable("Definitely Not A Real Font XYZ")).toBe(false);
  });

  it("treats generic and empty families as available", () => {
    expect(isFontAvailable("")).toBe(true);
    expect(isFontAvailable("monospace")).toBe(true);
  });
});

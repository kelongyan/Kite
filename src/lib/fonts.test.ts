import { afterEach, describe, expect, it, vi } from "vitest";
import {
  detectMonoFontFamily,
  findUnavailableFonts,
  isFontAvailable,
  measureCjkAlignment,
  resolveFontFamily,
  splitLegacyFontFamily,
  suggestAlignedCjkFont,
} from "./fonts";

const FALLBACK =
  '"Kite Sans SC", "Sarasa Mono SC", "Sarasa Term SC", "Source Han Mono SC", "Source Han Sans SC", "LXGW WenKai Mono", "LXGW WenKai", "Noto Sans Mono CJK SC", "Noto Serif CJK SC", "Noto Sans SC", "Noto Serif SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei Mono", "Microsoft YaHei", "Microsoft YaHei UI", "DengXian", "SimHei", "SimSun", "FangSong", "KaiTi", "NSimSun", "SFMono-Regular", "Menlo", monospace';
const DEFAULT_STACK = `"Kite Mono", ${FALLBACK}`;

function withoutFallbackFamilies(...families: string[]): string {
  const removed = new Set(families.map((family) => family.toLowerCase()));
  return FALLBACK.split(", ")
    .filter((family) => !removed.has(family.replace(/"/g, "").toLowerCase()))
    .join(", ");
}

describe("resolveFontFamily", () => {
  it("uses the bundled mono font before explicit CJK fallbacks", () => {
    expect(resolveFontFamily("JetBrainsMono Nerd Font", "Microsoft YaHei")).toBe(
      `"JetBrainsMono Nerd Font", "Kite Mono", "Microsoft YaHei", ${withoutFallbackFamilies("Microsoft YaHei")}`,
    );
  });

  it("uses the bundled mono font before automatic CJK fallbacks", () => {
    expect(resolveFontFamily("Fira Code", "")).toBe(
      `"Fira Code", "Kite Mono", ${FALLBACK}`,
    );
  });

  it("cleans quotes and trims both font inputs", () => {
    expect(resolveFontFamily('  "Fira Code"  ', " 'SimSun' ")).toBe(
      `"Fira Code", "Kite Mono", "SimSun", ${withoutFallbackFamilies("SimSun")}`,
    );
  });

  it("accepts comma-separated advanced stacks and removes duplicates", () => {
    expect(resolveFontFamily("Foo, monospace", "Microsoft YaHei")).toBe(
      `"Foo", monospace, "Kite Mono", "Microsoft YaHei", ${FALLBACK.replace(
        ", \"Microsoft YaHei\"",
        "",
      ).replace(", monospace", "")}`,
    );
  });

  it("strips stray internal quotes to avoid malformed tokens", () => {
    expect(resolveFontFamily('Foo"Bar', "")).toBe(
      `"FooBar", "Kite Mono", ${FALLBACK}`,
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

describe("resolveFontFamily fallback filtering", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // The bundled family always matches (document.fonts lists the @font-face),
  // every other candidate measures as the baseline, i.e. not installed.
  // The candidate cache keys on the live document, so each stub re-probes.
  function stubOnlyBundledInstalled() {
    const blankCanvas = { measureText: () => ({ width: 100 }), font: "" };
    vi.stubGlobal("document", {
      fonts: [{ family: '"Kite Sans SC"' }],
      createElement: () => ({ getContext: () => blankCanvas }),
    });
  }

  it("keeps only candidates the availability probe matches", () => {
    stubOnlyBundledInstalled();
    expect(resolveFontFamily("", "")).toBe(
      '"Kite Mono", "Kite Sans SC", "SFMono-Regular", "Menlo", monospace',
    );
  });

  it("keeps the full chain when the probe matches nothing at all", () => {
    // jsdom-like: no @font-face list, canvas measures every family as the
    // baseline. The chain must not collapse to nothing.
    vi.stubGlobal("document", {
      fonts: [],
      createElement: () => ({
        getContext: () => ({ measureText: () => ({ width: 100 }), font: "" }),
      }),
    });
    expect(resolveFontFamily("Fira Code", "")).toBe(
      `"Fira Code", "Kite Mono", ${FALLBACK}`,
    );
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
      codeFontFamily: "Kite Mono",
      cjkFontFamily: "",
    });
    expect(splitLegacyFontFamily("Monaco")).toEqual({
      codeFontFamily: "Kite Mono",
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
    stubDocument(['"Kite Mono"', "Inter Variable"], blankCanvas);

    expect(isFontAvailable("Kite Mono")).toBe(true);
    expect(isFontAvailable("  'kite mono'  ")).toBe(true);
    expect(isFontAvailable("Inter Variable")).toBe(true);
  });

  it("does not claim a family that is neither bundled nor installed", () => {
    stubDocument(['"Kite Mono"'], blankCanvas);

    expect(isFontAvailable("Definitely Not A Real Font XYZ")).toBe(false);
  });

  it("treats generic and empty families as available", () => {
    expect(isFontAvailable("")).toBe(true);
    expect(isFontAvailable("monospace")).toBe(true);
  });
});

describe("findUnavailableFonts", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubMissingProbe() {
    vi.stubGlobal("document", {
      fonts: [],
      createElement: () => ({
        getContext: () => ({ measureText: () => ({ width: 100 }), font: "" }),
      }),
    });
  }

  it("reports only the families the probe cannot match", () => {
    stubMissingProbe();
    expect(findUnavailableFonts("LXGW WenKai Regular, Def Not Real XYZ")).toEqual(
      ["LXGW WenKai Regular", "Def Not Real XYZ"],
    );
  });

  it("keeps generic families and ignores separators and quotes", () => {
    stubMissingProbe();
    expect(findUnavailableFonts(" 'Fira Code' ,, monospace ")).toEqual([
      "Fira Code",
    ]);
  });

  it("returns nothing for an empty value", () => {
    stubMissingProbe();
    expect(findUnavailableFonts("")).toEqual([]);
  });
});

describe("measureCjkAlignment", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubCanvas(widths: Record<string, number>) {
    const ctx = {
      font: "",
      measureText: (text: string) => ({ width: widths[text] ?? 0 }),
    };
    vi.stubGlobal("document", {
      createElement: () => ({ getContext: () => ctx }),
    });
  }

  it("reports aligned when the CJK advance is exactly two cells", () => {
    stubCanvas({ "0": 9.6, "\u6f22": 19.2 });
    const r = measureCjkAlignment("JetBrains Mono", "Noto Sans SC");
    expect(r?.ok).toBe(true);
    expect(r?.cell).toBe(9.6);
  });

  it("reports misaligned when the CJK advance is wider than two cells", () => {
    stubCanvas({ "0": 9.6, "\u6f22": 16 });
    const r = measureCjkAlignment("JetBrains Mono", "Noto Sans SC");
    expect(r?.ok).toBe(false);
  });

  it("tolerates subpixel rounding inside 6% of a cell", () => {
    stubCanvas({ "0": 9.6, "\u6f22": 19.7 });
    const r = measureCjkAlignment("JetBrains Mono", "Noto Sans SC");
    expect(r?.ok).toBe(true);
  });

  it("returns null without a 2D context", () => {
    vi.stubGlobal("document", {
      createElement: () => ({ getContext: () => null }),
    });
    expect(measureCjkAlignment("JetBrains Mono", "")).toBeNull();
  });
});

describe("ensureMonoFontsLoaded weight handling", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  function stubFontLoader() {
    const loaded: string[] = [];
    vi.stubGlobal("document", {
      fonts: {
        load: (spec: string) => {
          loaded.push(spec);
          return Promise.resolve();
        },
      },
    });
    return loaded;
  }

  it("loads the preference weight alongside the base pair", async () => {
    const loaded = stubFontLoader();
    const { ensureMonoFontsLoaded } = await import("./fonts");
    await ensureMonoFontsLoaded("500");
    expect(loaded).toContain('500 14px "Kite Mono"');
    expect(loaded).toContain('500 14px "Kite Sans SC"');
    expect(loaded).toContain('400 14px "Kite Mono"');
  });

  it("maps bold to 700 and normal to 400", async () => {
    const loaded = stubFontLoader();
    const { ensureMonoFontsLoaded } = await import("./fonts");
    await ensureMonoFontsLoaded("bold");
    expect(loaded).toContain('700 14px "Kite Mono"');
    expect(loaded).not.toContain('bold 14px "Kite Mono"');
    await ensureMonoFontsLoaded("normal");
    expect(loaded).toContain('400 14px "Kite Mono"');
  });
});

describe("suggestAlignedCjkFont", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the first candidate the probe sees installed", () => {
    // The availability probe compares the candidate against the generic
    // baselines: only Sarasa measures differently, so it is the suggestion.
    const ctx = {
      font: "",
      measureText: (_text: string) => ({
        width: ctx.font.includes("Sarasa Mono SC") ? 110 : 100,
      }),
    };
    vi.stubGlobal("document", {
      fonts: [],
      createElement: () => ({ getContext: () => ctx }),
    });
    expect(suggestAlignedCjkFont()).toBe("Sarasa Mono SC");
  });

  it("returns null when no candidate is installed", () => {
    vi.stubGlobal("document", {
      fonts: [],
      createElement: () => ({
        getContext: () => ({ measureText: () => ({ width: 100 }), font: "" }),
      }),
    });
    expect(suggestAlignedCjkFont()).toBeNull();
  });
});

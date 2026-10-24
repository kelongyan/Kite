// Bundled faces ship under private family names ("Kite Mono", "Kite Sans
// SC") so the @font-face declarations never shadow a system install of the
// upstream families: a user who installed JetBrains Mono (possibly a Nerd
// Font patch) gets their copy when they select it by name.
export const DEFAULT_MONO_FONT_FAMILY = "Kite Mono";
export const DEFAULT_CJK_FONT_FAMILY = "Kite Sans SC";

const CJK_FONT_CANDIDATES = [
  "Kite Sans SC",
  "Sarasa Mono SC",
  "Sarasa Term SC",
  "Source Han Mono SC",
  "Source Han Sans SC",
  "LXGW WenKai Mono",
  // Windows registers LXGW WenKai without the "Mono" suffix (family id 1 is
  // "LXGW WenKai"), so the Mono spelling alone leaves a user who installed it
  // with no matching entry.
  "LXGW WenKai",
  "Noto Sans Mono CJK SC",
  "Noto Serif CJK SC",
  // Windows/macOS ship Noto under "Noto Sans SC"; only Linux fontconfig
  // exposes the "... CJK SC" aliases above, so both spellings must be listed
  // or a Noto selection silently falls through on non-Linux systems.
  "Noto Sans SC",
  "Noto Serif SC",
  "Microsoft YaHei Mono",
  "Microsoft YaHei",
  "Microsoft YaHei UI",
  "DengXian",
  "SimHei",
  "SimSun",
  "FangSong",
  "KaiTi",
  "NSimSun",
];

const GENERIC_FONT_FAMILIES = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-monospace",
]);
const SYSTEM_MONO_FALLBACKS = ["SFMono-Regular", "Menlo", "monospace"];
const LEGACY_CJK_FONT_FAMILIES = new Set(
  [
    ...CJK_FONT_CANDIDATES,
    "PingFang SC",
    "Hiragino Sans GB",
    "WenQuanYi Micro Hei",
    "Noto Sans CJK SC",
  ].map((family) => family.toLowerCase()),
);

function parseFontFamilies(value: string): string[] {
  return value
    .split(",")
    .map((family) => family.trim().replace(/['"]/g, ""))
    .filter(Boolean);
}

function formatFontFamily(family: string): string {
  return GENERIC_FONT_FAMILIES.has(family.toLowerCase())
    ? family.toLowerCase()
    : `"${family}"`;
}

function uniqueFontFamilies(families: string[]): string[] {
  const seen = new Set<string>();
  return families.filter((family) => {
    const key = family.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

let monoReady: Promise<void> | null = null;
let monoReadyWeight: string | null = null;

function cssWeight(weight: string | undefined): string {
  // xterm accepts "normal"/"bold" or numeric strings; map the two keywords to
  // the numeric weights so the loader and the atlas agree on one face.
  if (weight === "bold") return "700";
  if (!weight || weight === "normal") return "400";
  return weight;
}

// Both bundled faces must be loaded before the terminal measures its first
// cell: an unloaded face falls back and the glyph grid is mismeasured until a
// relayout. The CJK face is loaded at the size the terminal uses so woff2
// decompression is not paid twice. The preference weight is loaded alongside
// the 400/700 pair because bold spans and the chosen weight can both be in
// play; a repeated call with the same weight returns the cached promise.
export function ensureMonoFontsLoaded(weight?: string): Promise<void> {
  const w = cssWeight(weight);
  if (monoReady && monoReadyWeight === w) return monoReady;
  if (typeof document === "undefined" || !document.fonts?.load) {
    monoReady = Promise.resolve();
    monoReadyWeight = w;
    return monoReady;
  }
  const weights = w === "400" || w === "700" ? ["400", "700"] : ["400", "700", w];
  monoReady = Promise.allSettled(
    weights.flatMap((x) => [
      document.fonts.load(`${x} 14px "Kite Mono"`),
      document.fonts.load(`${x} 14px "Kite Sans SC"`),
    ]),
  ).then(() => undefined);
  monoReadyWeight = w;
  return monoReady;
}

export function resolveFontFamily(
  codeFontFamily: string,
  cjkFontFamily = "",
): string {
  const codeFamilies = parseFontFamilies(codeFontFamily);
  const cjkFamilies = parseFontFamilies(cjkFontFamily);
  const families = uniqueFontFamilies([
    ...(codeFamilies.length > 0 ? codeFamilies : [DEFAULT_MONO_FONT_FAMILY]),
    DEFAULT_MONO_FONT_FAMILY,
    ...cjkFamilies,
    ...CJK_FONT_CANDIDATES,
    ...SYSTEM_MONO_FALLBACKS,
  ]);
  return families.map(formatFontFamily).join(", ");
}

export function splitLegacyFontFamily(value: string | undefined): {
  codeFontFamily: string;
  cjkFontFamily: string;
} {
  const normalized = value?.trim() ?? "";
  if (!normalized || normalized.toLowerCase() === "monaco") {
    return { codeFontFamily: DEFAULT_MONO_FONT_FAMILY, cjkFontFamily: "" };
  }

  const families = parseFontFamilies(normalized);
  if (families.length < 2) {
    return { codeFontFamily: normalized, cjkFontFamily: "" };
  }

  const codeFontFamily = families[0];
  const cjkIndex = families.findIndex(
    (family, index) =>
      index > 0 && LEGACY_CJK_FONT_FAMILIES.has(family.toLowerCase()),
  );
  if (cjkIndex !== 1) {
    return { codeFontFamily: normalized, cjkFontFamily: "" };
  }

  const trailingFamilies = families.slice(cjkIndex + 1);
  if (
    trailingFamilies.some(
      (family) => !GENERIC_FONT_FAMILIES.has(family.toLowerCase()),
    )
  ) {
    return { codeFontFamily: normalized, cjkFontFamily: "" };
  }

  return {
    codeFontFamily,
    cjkFontFamily: families[cjkIndex],
  };
}

export function detectMonoFontFamily(): string {
  return resolveFontFamily(DEFAULT_MONO_FONT_FAMILY);
}

// Mixed latin + CJK so a font missing only one script still probes as present
// for the script it does cover.
const FONT_PROBE_TEXT = "mmmmmmmmmmlli\u6c49\u5b57\u4e2d\u6587WW";
const FONT_PROBE_BASELINES = ["monospace", "sans-serif", "serif"] as const;

// Families this app ships itself (see src/styles/fonts.css). The declared
// @font-face shadows any system install of the same name, so a canvas probe
// measures the web font instead of the machine's copy — and an unused face
// stays `unloaded` forever, which reads as an exact baseline match. Since we
// bundle the file, the family always renders and must not be flagged missing.
function bundledFontFamilies(): Set<string> {
  const families = new Set<string>();
  if (typeof document === "undefined" || !document.fonts) return families;
  for (const face of document.fonts) {
    families.add(face.family.trim().replace(/['"]/g, "").toLowerCase());
  }
  return families;
}

// Detects whether a named family is actually installed. `document.fonts.check`
// can report a fallback as present, so we compare rendered glyph widths against
// the generic baselines the family is layered on: a real font shifts the width
// for at least one baseline, a missing one matches every baseline exactly.
export function isFontAvailable(family: string): boolean {
  const name = family.trim().replace(/['"]/g, "");
  if (!name) return true;
  if (GENERIC_FONT_FAMILIES.has(name.toLowerCase())) return true;
  if (typeof document === "undefined") return true;
  if (bundledFontFamilies().has(name.toLowerCase())) return true;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  // No 2D context (headless/jsdom): don't hide options we cannot verify.
  if (!ctx) return true;
  const size = 48;
  for (const baseline of FONT_PROBE_BASELINES) {
    ctx.font = `${size}px ${baseline}`;
    const baseWidth = ctx.measureText(FONT_PROBE_TEXT).width;
    ctx.font = `${size}px "${name}", ${baseline}`;
    if (ctx.measureText(FONT_PROBE_TEXT).width !== baseWidth) return true;
  }
  return false;
}

/**
 * Families in a comma-separated preference value that the system cannot match.
 * The picker is free-text, and Windows registers many styles under display
 * names that are not the CSS family ("Space Mono Italic" and
 * "JetBrainsMono NF Bold" are styles of families named without the suffix), so
 * such a value resolves to nothing and the fallback chain silently substitutes
 * another face. Report those, but never block the commit: the probe has false
 * negatives (a pure CJK family can measure exactly the baseline widths), and a
 * variable font or a not-yet-loaded face can also read as missing.
 */
export function findUnavailableFonts(value: string): string[] {
  return parseFontFamilies(value).filter((family) => !isFontAvailable(family));
}

// ── CJK cell-width alignment ───────────────────────────────────────────────
//
// xterm lays the grid on one latin cell width and renders every glyph through
// the same CSS stack. A CJK family whose ideograph advance is wider than two
// latin cells (or a code font with a non-standard ratio) leaves gaps or
// overlap in the two-column CJK cells. kitty solves this by rescaling every
// fallback glyph to the cell; the DOM/WebGL renderers cannot, so Kite's
// equivalent is measuring the pair and telling the user, with a suggested
// fix, instead of silently misrendering.

export type CjkAlignment = {
  ok: boolean;
  codeAdvance: number;
  cjkAdvance: number;
  cell: number;
};

const ALIGN_PROBE_CJK = "\u6f22";

function measureAdvance(
  ctx: CanvasRenderingContext2D,
  familyStack: string,
  text: string,
): number {
  ctx.font = `16px ${familyStack}`;
  return ctx.measureText(text).width;
}

/**
 * Measure whether the resolved code/CJK stack keeps ideographs at two latin
 * cells. Returns null when measurement is impossible (no 2D context, e.g.
 * jsdom) so callers can skip the hint rather than report a false problem.
 */
export function measureCjkAlignment(
  codeFontFamily: string,
  cjkFontFamily: string,
): CjkAlignment | null {
  if (typeof document === "undefined") return null;
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return null;
  const resolved = resolveFontFamily(codeFontFamily, cjkFontFamily);
  const codeStack = `${resolved}, monospace`;
  // "0" advance approximates the terminal's cell width for the code face;
  // measure against the same stack so the CJK family sits at its real spot.
  const cell = measureAdvance(ctx, codeStack, "0");
  if (cell <= 0) return null;
  const codeAdvance = cell;
  const cjkAdvance = measureAdvance(ctx, codeStack, ALIGN_PROBE_CJK);
  return {
    ok: Math.abs(cjkAdvance - 2 * cell) <= 0.06 * cell,
    codeAdvance,
    cjkAdvance,
    cell,
  };
}

/**
 * First installed family from the known 2:1-friendly list (Sarasa-derived
 * fonts are built at exactly two latin cells per ideograph). Returns null
 * when none of them is installed.
 */
export function suggestAlignedCjkFont(): string | null {
  const candidates = [
    "Sarasa Mono SC",
    "Sarasa Term SC",
    "Maple Mono NF CN",
    "LXGW WenKai Mono",
    "LXGW WenKai",
  ];
  for (const family of candidates) {
    if (isFontAvailable(family)) return family;
  }
  return null;
}

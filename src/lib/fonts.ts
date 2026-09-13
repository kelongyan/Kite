export const DEFAULT_MONO_FONT_FAMILY = "JetBrains Mono";

const CJK_FONT_CANDIDATES = [
  "Sarasa Mono SC",
  "Sarasa Term SC",
  "Source Han Mono SC",
  "Source Han Sans SC",
  "LXGW WenKai Mono",
  "Noto Sans Mono CJK SC",
  "Noto Serif CJK SC",
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

export function ensureMonoFontsLoaded(): Promise<void> {
  if (monoReady) return monoReady;
  if (typeof document === "undefined" || !document.fonts?.load) {
    monoReady = Promise.resolve();
    return monoReady;
  }
  monoReady = Promise.allSettled([
    document.fonts.load('400 14px "JetBrains Mono"'),
    document.fonts.load('700 14px "JetBrains Mono"'),
  ]).then(() => undefined);
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

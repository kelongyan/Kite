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

const quote = (family: string) => `"${family}"`;

const CJK_FALLBACK_CHAIN = CJK_FONT_CANDIDATES.map(quote).join(", ");
const FALLBACK_CHAIN = `${CJK_FALLBACK_CHAIN}, SFMono-Regular, Menlo, monospace`;
const DEFAULT_FONT_STACK = `${quote(DEFAULT_MONO_FONT_FAMILY)}, ${FALLBACK_CHAIN}`;

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

export function resolveFontFamily(userInput: string): string {
  const name = userInput.trim();
  if (!name) return DEFAULT_FONT_STACK;
  // A comma means the user gave a full stack; otherwise quote the single family.
  // Strip any quotes first so a stray quote can't produce a malformed token.
  const head = name.includes(",")
    ? name
    : `"${name.replace(/['"]/g, "")}"`;
  return `${head}, ${FALLBACK_CHAIN}`;
}

export function detectMonoFontFamily(): string {
  return DEFAULT_FONT_STACK;
}

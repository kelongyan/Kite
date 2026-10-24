// Search decorations prefer solid #RRGGBB colors. Kite theme tokens arrive as
// oklch (globals baseline) or rgb() (computed styles), so both formats are
// normalized here; anything else falls back to the raw CSS string, which DOM
// decorations still accept.

const RGB_RE = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/;
const OKLCH_RE = /^oklch\(\s*([\d.]+)%?\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*[\d.]+)?\s*\)/;

export function cssColorToHex(color: string): string | null {
  const value = color.trim();
  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase();
  const rgb = RGB_RE.exec(value);
  if (rgb) {
    const [, r, g, b] = rgb;
    return (
      "#" +
      [r, g, b]
        .map((part) => Number.parseInt(part, 10).toString(16).padStart(2, "0"))
        .join("")
    );
  }
  const oklch = OKLCH_RE.exec(value);
  if (oklch) return oklchToHex(oklch[1], oklch[2], oklch[3]);
  return null;
}

/** OKLCH (L 0..1, C, H in degrees) to sRGB #rrggbb, clamped to the gamut. */
export function oklchToHex(
  lightness: string | number,
  chroma: string | number,
  hue: string | number,
): string {
  const L = Number(lightness);
  const C = Number(chroma);
  const h = (Number(hue) * Math.PI) / 180;
  if (!Number.isFinite(L) || !Number.isFinite(C) || !Number.isFinite(h)) {
    return "#000000";
  }
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];

  const channel = (v: number) => {
    const clamped = Math.min(1, Math.max(0, v));
    const encoded =
      clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
    return Math.round(encoded * 255)
      .toString(16)
      .padStart(2, "0");
  };

  return `#${channel(linear[0])}${channel(linear[1])}${channel(linear[2])}`;
}

export function mixHex(a: string, b: string, ratio: number): string {
  const parse = (hex: string): [number, number, number] => [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const t = Math.min(1, Math.max(0, ratio));
  const mix = (from: number, to: number) =>
    Math.round(from + (to - from) * t)
      .toString(16)
      .padStart(2, "0");
  return `#${mix(ar, br)}${mix(ag, bg)}${mix(ab, bb)}`;
}

export type SearchDecorationColors = {
  matchBackground: string;
  activeMatchBackground: string;
  matchOverviewRuler: string;
  activeMatchColorOverviewRuler: string;
};

// The active match reuses the selection color so it reads as "selected" in any
// theme; other matches are the same color blended toward the background so
// they stay visibly secondary.
export function buildSearchDecorationColors(
  selection: string,
  background: string,
): SearchDecorationColors {
  const selectionHex = cssColorToHex(selection);
  const backgroundHex = cssColorToHex(background);
  const active = selectionHex ?? (selection.trim() || "#000000");
  const muted =
    selectionHex && backgroundHex
      ? mixHex(selectionHex, backgroundHex, 0.5)
      : active;
  return {
    matchBackground: muted,
    activeMatchBackground: active,
    matchOverviewRuler: muted,
    activeMatchColorOverviewRuler: active,
  };
}

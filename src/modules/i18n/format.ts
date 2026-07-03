import type { AppLanguage } from "./locale";

export function formatNumber(
  language: AppLanguage,
  value: number,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(language, options).format(value);
}

export function formatCompactNumber(
  language: AppLanguage,
  value: number,
): string {
  return formatNumber(language, value, { notation: "compact" });
}

export function formatPercent(language: AppLanguage, value: number): string {
  return formatNumber(language, value, {
    style: "percent",
    maximumFractionDigits: 0,
  });
}

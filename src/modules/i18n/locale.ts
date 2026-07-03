export const APP_LANGUAGES = ["en", "zh-CN"] as const;

export type AppLanguage = (typeof APP_LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<AppLanguage, string> = {
  en: "English",
  "zh-CN": "简体中文",
};

export function coerceAppLanguage(value: unknown): AppLanguage {
  return value === "zh-CN" ? "zh-CN" : "en";
}

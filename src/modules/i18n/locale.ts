export const APP_LANGUAGES = ["zh-CN"] as const;

export type AppLanguage = (typeof APP_LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<AppLanguage, string> = {
  "zh-CN": "简体中文",
};

export function coerceAppLanguage(_value: unknown): AppLanguage {
  return "zh-CN";
}

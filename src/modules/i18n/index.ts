import { usePreferencesStore } from "@/modules/settings/preferences";
import { formatCompactNumber, formatNumber, formatPercent } from "./format";
import { type AppLanguage, coerceAppLanguage } from "./locale";
import { en, type Messages } from "./messages/en";
import { zhCN } from "./messages/zh-CN";

const MESSAGES: Record<AppLanguage, Messages> = {
  en,
  "zh-CN": zhCN,
};

export function messagesFor(language: unknown): Messages {
  return MESSAGES[coerceAppLanguage(language)];
}

export function useAppLanguage(): AppLanguage {
  return usePreferencesStore((s) => s.appLanguage);
}

export function useMessages(): Messages {
  return messagesFor(useAppLanguage());
}

export { formatCompactNumber, formatNumber, formatPercent, type AppLanguage };
export { APP_LANGUAGES, LANGUAGE_LABELS, coerceAppLanguage } from "./locale";
export type { Messages } from "./messages/en";

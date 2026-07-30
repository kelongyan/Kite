import { formatCompactNumber, formatNumber, formatPercent } from "./format";
import type { AppLanguage } from "./locale";
import { zhCN, type Messages } from "./messages/zh-CN";

export function messagesFor(_language?: unknown): Messages {
  return zhCN;
}

export function useAppLanguage(): AppLanguage {
  return "zh-CN";
}

export function useMessages(): Messages {
  return zhCN;
}

export { formatCompactNumber, formatNumber, formatPercent, type AppLanguage };
export { APP_LANGUAGES, LANGUAGE_LABELS, coerceAppLanguage } from "./locale";
export type { Messages } from "./messages/zh-CN";

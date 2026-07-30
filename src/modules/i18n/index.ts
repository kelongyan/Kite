import { zhCN, type Messages } from "./messages/zh-CN";

export function useMessages(): Messages {
  return zhCN;
}

export type { Messages } from "./messages/zh-CN";

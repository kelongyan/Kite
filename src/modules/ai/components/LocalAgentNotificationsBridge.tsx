import { routeAgentNotification } from "@/modules/agents/lib/route";
import { useWindowFocus } from "@/modules/agents/lib/useWindowFocus";
import { useAgentStore } from "@/modules/agents/store/agentStore";
import type { AgentStatus } from "@/modules/agents/lib/types";
import { useMessages } from "@/modules/i18n";
import { useEffect, useRef } from "react";
import { useChatStore } from "../store/chatStore";

type RunStatus =
  | "idle"
  | "thinking"
  | "streaming"
  | "awaiting-approval"
  | "error";

function isBusy(s: RunStatus): boolean {
  return s === "thinking" || s === "streaming" || s === "awaiting-approval";
}

function liveStatus(s: RunStatus): AgentStatus | null {
  if (s === "awaiting-approval") return "waiting";
  if (s === "thinking" || s === "streaming") return "working";
  return null;
}

export function LocalAgentNotificationsBridge() {
  const messages = useMessages().ai.notifications;
  const status = useChatStore((s) => s.agentMeta.status) as RunStatus;
  const error = useChatStore((s) => s.agentMeta.error);
  const visible = useChatStore((s) => s.panelOpen || s.mini.open);
  const focused = useWindowFocus();

  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const focusedRef = useRef(focused);
  focusedRef.current = focused;
  const prev = useRef<RunStatus>(status);

  useEffect(() => {
    const nextStatus = liveStatus(status);
    useAgentStore.getState().setLocalAgent(
      nextStatus ? { agent: messages.localAgent, status: nextStatus } : null,
    );

    const was = prev.current;
    prev.current = status;
    if (was === status) return;

    const fire = (
      kind: "attention" | "finished" | "error",
      title: string,
      body?: string,
    ) =>
      routeAgentNotification({
        source: "local",
        agent: messages.localAgent,
        kind,
        title,
        body,
        focused: focusedRef.current,
        visible: visibleRef.current,
        allowToast: true,
        onActivate: () => useChatStore.getState().openPanel(),
      });

    if (status === "awaiting-approval") {
      fire("attention", messages.approvalTitle, messages.approvalBody);
    } else if (status === "error") {
      fire("error", messages.runFailedTitle, error ?? undefined);
    } else if (status === "idle" && isBusy(was)) {
      fire("finished", messages.finishedTitle, messages.finishedBody);
    }
  }, [status, error, messages]);

  return null;
}

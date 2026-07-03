import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useMessages } from "@/modules/i18n";
import { AlertCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useChatStore, type AgentMeta } from "../store/chatStore";

type Props = {
  onClick: () => void;
};

export function AgentStatusPill({ onClick }: Props) {
  const messages = useMessages().ai.chat;
  const meta = useChatStore((s) => s.agentMeta);

  // awaiting-approval is surfaced by the notification + auto-opened mini window.
  if (meta.status === "awaiting-approval") return null;
  if (meta.status === "idle" && !meta.error) return null;

  const { tone, icon, label } = describe(meta, messages);

  return (
    <button
      key={`${meta.status}:${label}`}
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-6 items-center gap-1.5 rounded-md border px-1.5 text-[11px] transition-colors",
        "animate-in fade-in-0 slide-in-from-top-1 duration-150 ease-out",
        tone,
      )}
      title={messages.openAiLog}
    >
      {icon}
      <span className="max-w-[180px] truncate">{label}</span>
    </button>
  );
}

function describe(
  meta: AgentMeta,
  messages: ReturnType<typeof useMessages>["ai"]["chat"],
): {
  tone: string;
  icon: React.ReactNode;
  label: string;
} {
  if (meta.status === "error") {
    return {
      tone:
        "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15",
      icon: (
        <HugeiconsIcon icon={AlertCircleIcon} size={12} strokeWidth={1.75} />
      ),
      label: meta.error ?? messages.error,
    };
  }
  // thinking | streaming
  return {
    tone:
      "border-border/60 bg-card text-muted-foreground hover:text-foreground",
    icon: <Spinner className="size-3" />,
    label: meta.step ?? messages.thinking,
  };
}

import { useMessages } from "@/modules/i18n";
import { useEffect, useRef } from "react";

type Props = {
  x: number;
  y: number;
  onDone: () => void;
};

export function CopiedBubble({ x, y, onDone }: Props) {
  const messages = useMessages();
  // Keep a ref to onDone so the timeout always calls the latest version
  // without the effect needing to re-run (and restart the timer).
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    const id = window.setTimeout(() => onDoneRef.current(), 1200);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        left: x,
        top: y - 40,
        zIndex: 9999,
        pointerEvents: "none",
      }}
      className="kite-copied-bubble flex items-center gap-1 rounded border border-border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-sm"
    >
      {/* checkmark icon */}
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M1.5 5L4 7.5L8.5 2.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {messages.common.copied}
    </div>
  );
}

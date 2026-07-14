import { useEffect, useRef } from "react";

// Inject the keyframe once into the document head; avoids a separate CSS file.
let styleInjected = false;
function injectStyle() {
  if (styleInjected) return;
  styleInjected = true;
  const el = document.createElement("style");
  el.textContent = `
@keyframes terminal-copied {
  0%   { opacity: 0; transform: translateX(-50%) translateY(4px);  }
  12%  { opacity: 1; transform: translateX(-50%) translateY(0);    }
  72%  { opacity: 1; transform: translateX(-50%) translateY(0);    }
  100% { opacity: 0; transform: translateX(-50%) translateY(-4px); }
}`;
  document.head.appendChild(el);
}

type Props = {
  x: number;
  y: number;
  onDone: () => void;
};

export function CopiedBubble({ x, y, onDone }: Props) {
  // Keep a ref to onDone so the timeout always calls the latest version
  // without the effect needing to re-run (and restart the timer).
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    injectStyle();
    const id = setTimeout(() => onDoneRef.current(), 1300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: "fixed",
        left: x,
        top: y - 40,
        transform: "translateX(-50%)",
        animation: "terminal-copied 1.3s ease-out forwards",
        pointerEvents: "none",
        zIndex: 9999,
      }}
      className="flex items-center gap-1 rounded border border-border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-sm"
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
      Copied
    </div>
  );
}

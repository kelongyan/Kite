import { useMessages } from "@/modules/i18n";
import { useTheme } from "@/modules/theme";
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { CopiedBubble } from "./CopiedBubble";
import { useTerminalSession } from "./lib/useTerminalSession";

export type TerminalPaneHandle = {
  write: (data: string) => void;
  focus: () => void;
  getBuffer: (maxLines?: number) => string | null;
  getSelection: () => string | null;
};

type Props = {
  /** Stable identifier for this leaf (passed back through callbacks). */
  leafId: number;
  /** Tab containing this pane is on screen. */
  visible: boolean;
  /** This leaf is the active pane within its tab — receives auto-focus. */
  focused?: boolean;
  initialCwd?: string;
  onExit?: (leafId: number, code: number) => void;
  onCwd?: (leafId: number, cwd: string) => void;
};

export const TerminalPane = memo(
  forwardRef<TerminalPaneHandle, Props>(function TerminalPane(
    {
      leafId,
      visible,
      focused = true,
      initialCwd,
      onExit,
      onCwd,
    },
    ref,
  ) {
    const messages = useMessages();
    const containerRef = useRef<HTMLDivElement>(null);
    const mousePosRef = useRef({ x: 0, y: 0 });
    const [copied, setCopied] = useState<{
      x: number;
      y: number;
      seq: number;
    } | null>(null);
    const copiedSeqRef = useRef(0);
    const [copiedNotice, setCopiedNotice] = useState("");
    const noticeTimerRef = useRef<number | null>(null);
    const clearCopied = useCallback(() => setCopied(null), []);
    const { resolvedMode, themeId, customThemes } = useTheme();

    const session = useTerminalSession({
      leafId,
      container: containerRef,
      visible,
      focused,
      initialCwd,
      themeMode: resolvedMode,
      onExit: (c) => onExit?.(leafId, c),
      onCwd: (c) => onCwd?.(leafId, c),
    });

    // biome-ignore lint/correctness/useExhaustiveDependencies: theme values invalidate CSS tokens read inside applyTheme.
    useEffect(() => {
      // Defer one frame so CSS-variable token resolution sees the new class.
      const id = requestAnimationFrame(() => session.applyTheme());
      return () => cancelAnimationFrame(id);
    }, [resolvedMode, themeId, customThemes, session]);

    useImperativeHandle(
      ref,
      () => ({
        write: (data: string) => session.write(data),
        focus: () => session.focus(),
        getBuffer: (max?: number) => session.getBuffer(max),
        getSelection: () => session.getSelection(),
      }),
      [session],
    );

    // Copy feedback: anchor at the selection end when possible, then the pane
    // center, then the last mouse-up. The visual bubble remounts per copy so
    // repeated copies restart the animation; the live region is permanent so
    // screen readers are not cut off when the bubble unmounts.
    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const handler = () => {
        const anchor = session.getSelectionAnchor();
        const rect = containerRef.current?.getBoundingClientRect();
        const fallback = mousePosRef.current;
        setCopied({
          x: anchor?.x ?? (rect ? rect.left + rect.width / 2 : fallback.x),
          y: anchor?.y ?? (rect ? rect.top + rect.height / 2 : fallback.y),
          seq: ++copiedSeqRef.current,
        });
        setCopiedNotice("");
        if (noticeTimerRef.current !== null) {
          window.clearTimeout(noticeTimerRef.current);
        }
        noticeTimerRef.current = window.setTimeout(() => {
          setCopiedNotice(messages.common.copied);
          noticeTimerRef.current = window.setTimeout(() => {
            setCopiedNotice("");
            noticeTimerRef.current = null;
          }, 3000);
        }, 20);
      };
      el.addEventListener("terminal:copied", handler);
      return () => el.removeEventListener("terminal:copied", handler);
    }, [messages.common.copied, session]);

    useEffect(() => {
      return () => {
        if (noticeTimerRef.current !== null) {
          window.clearTimeout(noticeTimerRef.current);
        }
      };
    }, []);

    const hideStyle = {
      visibility: visible ? ("visible" as const) : ("hidden" as const),
      pointerEvents: visible ? ("auto" as const) : ("none" as const),
    };

    return (
      <>
        <div className="relative h-full w-full">
          <div
            ref={containerRef}
            className="zoom-exempt h-full w-full"
            style={hideStyle}
            onMouseUp={(e) => {
              mousePosRef.current = { x: e.clientX, y: e.clientY };
            }}
          />
          {!session.started && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center bg-background/70 text-[11px] text-muted-foreground">
              {messages.common.startingShell}
            </div>
          )}
        </div>
        <span
          className="sr-only"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {copiedNotice}
        </span>
        {copied &&
          createPortal(
            <CopiedBubble
              key={copied.seq}
              x={copied.x}
              y={copied.y}
              onDone={clearCopied}
            />,
            document.body,
          )}
      </>
    );
  }),
);

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
    const containerRef = useRef<HTMLDivElement>(null);
    const mousePosRef = useRef({ x: 0, y: 0 });
    const [copiedPos, setCopiedPos] = useState<{ x: number; y: number } | null>(
      null,
    );
    const clearCopied = useCallback(() => setCopiedPos(null), []);
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

    // Show "Copied" bubble at the last mouse-up position when a copy fires.
    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const handler = () => setCopiedPos({ ...mousePosRef.current });
      el.addEventListener("terminal:copied", handler);
      return () => el.removeEventListener("terminal:copied", handler);
    }, []);

    const hideStyle = {
      visibility: visible ? ("visible" as const) : ("hidden" as const),
      pointerEvents: visible ? ("auto" as const) : ("none" as const),
    };

    return (
      <>
        <div
          ref={containerRef}
          className="zoom-exempt h-full w-full"
          style={hideStyle}
          onMouseUp={(e) => {
            mousePosRef.current = { x: e.clientX, y: e.clientY };
          }}
        />
        {copiedPos && (
          <CopiedBubble x={copiedPos.x} y={copiedPos.y} onDone={clearCopied} />
        )}
      </>
    );
  }),
);

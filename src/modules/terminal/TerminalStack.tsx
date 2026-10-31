import type { Tab } from "@/modules/tabs";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import { selectLiveTerminals } from "./lib/liveTerminals";
import { leafIds } from "./lib/panes";
import { PaneTreeView, type PaneCommand } from "./PaneTreeView";
import type { TerminalPaneHandle } from "./TerminalPane";

type Props = {
  tabs: Tab[];
  activeId: number;
  /** Register/unregister handle by leaf id (not tab id). */
  registerHandle: (leafId: number, handle: TerminalPaneHandle | null) => void;
  onCwd: (leafId: number, cwd: string) => void;
  onExit: (leafId: number, code: number) => void;
  onFocusLeaf: (tabId: number, leafId: number) => void;
  onPaneCommand: (leafId: number, command: PaneCommand) => void;
};

type Bundle = {
  setRef: (h: TerminalPaneHandle | null) => void;
  onCwd: (leafId: number, cwd: string) => void;
  onExit: (leafId: number, code: number) => void;
};

export function TerminalStack({
  tabs,
  activeId,
  registerHandle,
  onCwd,
  onExit,
  onFocusLeaf,
  onPaneCommand,
}: Props) {
  const terminals = useMemo(() => selectLiveTerminals(tabs), [tabs]);

  const registerRef = useRef(registerHandle);
  const cwdRef = useRef(onCwd);
  const exitRef = useRef(onExit);
  useEffect(() => {
    registerRef.current = registerHandle;
  }, [registerHandle]);
  useEffect(() => {
    cwdRef.current = onCwd;
  }, [onCwd]);
  useEffect(() => {
    exitRef.current = onExit;
  }, [onExit]);

  const bundles = useRef(new Map<number, Bundle>());
  const getBundle = (leafId: number): Bundle => {
    let b = bundles.current.get(leafId);
    if (!b) {
      b = {
        setRef: (h) => registerRef.current(leafId, h),
        onCwd: (id, cwd) => cwdRef.current(id, cwd),
        onExit: (id, code) => exitRef.current(id, code),
      };
      bundles.current.set(leafId, b);
    }
    return b;
  };

  useEffect(() => {
    const live = new Set<number>();
    for (const t of terminals)
      for (const id of leafIds(t.paneTree)) live.add(id);
    for (const id of bundles.current.keys()) {
      if (!live.has(id)) bundles.current.delete(id);
    }
  }, [terminals]);

  // Direction-aware stage entrance on tab switch (Tern's tsw-in-next/prev):
  // the incoming surface fades in from the direction it sits on the strip.
  // Under-160ms consecutive switches skip the animation so rapid Ctrl+Tab
  // never strobes.
  const [stageAnim, setStageAnim] = useState<{
    id: number;
    dir: "next" | "prev";
  } | null>(null);
  const prevActiveRef = useRef(activeId);
  const lastSwitchAtRef = useRef(0);

  useEffect(() => {
    const prev = prevActiveRef.current;
    if (prev === activeId) return;
    prevActiveRef.current = activeId;
    const prevIdx = tabs.findIndex((x) => x.id === prev);
    const nextIdx = tabs.findIndex((x) => x.id === activeId);
    if (prevIdx === -1 || nextIdx === -1) return;
    const now = performance.now();
    const quick = now - lastSwitchAtRef.current < 160;
    lastSwitchAtRef.current = now;
    if (quick) return;
    setStageAnim({ id: activeId, dir: nextIdx > prevIdx ? "next" : "prev" });
  }, [activeId, tabs]);

  useEffect(() => {
    if (!stageAnim) return;
    // Self-terminating like the tab enter animation: animationend clears it,
    // the timeout is the fallback if the frame never paints an event.
    const timer = setTimeout(() => setStageAnim(null), 700);
    return () => clearTimeout(timer);
  }, [stageAnim]);

  return (
    <div className="relative h-full w-full">
      {terminals.map((t) => {
        const tabVisible = t.id === activeId;
        const paneIds = leafIds(t.paneTree);
        return (
          <div
            key={t.id}
            className={cn(
              "absolute inset-0",
              stageAnim?.id === t.id &&
                (stageAnim.dir === "next"
                  ? "kite-stage-in-next"
                  : "kite-stage-in-prev"),
            )}
            style={{
              visibility: tabVisible ? "visible" : "hidden",
              pointerEvents: tabVisible ? "auto" : "none",
            }}
            aria-hidden={!tabVisible}
            onAnimationEnd={(e) => {
              if (
                e.target === e.currentTarget &&
                e.animationName.startsWith("kite-stage-in")
              ) {
                setStageAnim(null);
              }
            }}
          >
            <PaneTreeView
              node={t.paneTree}
              tabVisible={tabVisible}
              activeLeafId={t.activeLeafId}
              zoomedLeafId={t.zoomedLeafId}
              onFocusLeaf={(leafId) => onFocusLeaf(t.id, leafId)}
              getBundle={getBundle}
              paneCount={paneIds.length}
              // The last pane of the last tab cannot close (closing would quit).
              canClosePane={tabs.length > 1 || paneIds.length > 1}
              onPaneCommand={onPaneCommand}
            />
          </div>
        );
      })}
    </div>
  );
}

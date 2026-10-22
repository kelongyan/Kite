import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useMessages } from "@/modules/i18n";
import {
  Cancel01Icon,
  ComputerTerminal02Icon,
  PencilEdit02Icon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  type CSSProperties,
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { isTerminalLabelResolving, pathLabelFor } from "./lib/tabLabel";
import type { Tab } from "./lib/useTabs";

type Props = {
  tabs: Tab[];
  activeId: number;
  onSelect: (id: number) => void;
  onNew: () => void;
  onClose: (id: number) => void;
  /** Set a terminal tab's custom label; empty string resets to default. */
  onRename: (id: number, title: string) => void;
  /** Move a dragged tab to a new position (insertion gap index 0..tabs.length). */
  onReorder: (fromId: number, toGapIndex: number) => void;
  home?: string | null;
  homeResolved?: boolean;
  compact?: boolean;
};

type DragGhost = {
  tabId: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export function TabBar({
  tabs,
  activeId,
  onSelect,
  onNew,
  onClose,
  onRename,
  onReorder,
  home,
  homeResolved,
  compact,
}: Props) {
  const messages = useMessages().mainShell.tabs;
  const scrollRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dropGap, setDropGap] = useState<number | null>(null);
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    fromId: number;
    active: boolean;
    rect?: DOMRect;
  } | null>(null);
  const prevIdsRef = useRef<number[]>(tabs.map((t) => t.id));
  const [pillMoving, setPillMoving] = useState(true);
  const [ghost, setGhost] = useState<DragGhost | null>(null);
  const ghostRafRef = useRef<number | null>(null);
  const ghostPosRef = useRef<{ x: number; y: number } | null>(null);
  const autoScrollRef = useRef<{
    raf: number | null;
    dir: -1 | 0 | 1;
    x: number;
  }>({ raf: null, dir: 0, x: 0 });

  // Play the enter animation only for tabs opened after the first paint. The
  // animation is self-terminating: the id stays in `entering` until
  // animationend, so a cwd update or parent re-render cannot cut it short.
  const seenRef = useRef<Set<number> | null>(null);
  if (seenRef.current === null) {
    seenRef.current = new Set(tabs.map((t) => t.id));
  }
  const [entering, setEntering] = useState<ReadonlySet<number>>(
    () => new Set(),
  );

  useEffect(() => {
    const seen = seenRef.current;
    if (seen === null) return;
    const added = tabs.filter((t) => !seen.has(t.id)).map((t) => t.id);
    seenRef.current = new Set(tabs.map((t) => t.id));
    if (added.length === 0) return;
    setEntering((prev) => {
      const next = new Set(prev);
      for (const id of added) next.add(id);
      return next;
    });
  }, [tabs]);

  useEffect(() => {
    if (entering.size === 0) return;
    const id = window.setTimeout(() => setEntering(new Set<number>()), 400);
    return () => window.clearTimeout(id);
  }, [entering]);

  const clearEntering = useCallback((id: number) => {
    setEntering((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // Single shared pill slides to the active tab instead of each tab toggling
  // its own background. Measured relative to the list (its offsetParent) so it
  // scrolls with the strip for free; transform/width only, no layout on siblings.
  const [pill, setPill] = useState<{ left: number; width: number } | null>(
    null,
  );
  const [pillReady, setPillReady] = useState(false);

  const measurePill = useCallback(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      '[data-tab-active="true"]',
    );
    setPill(el ? { left: el.offsetLeft, width: el.offsetWidth } : null);
  }, []);

  useLayoutEffect(() => {
    measurePill();
  }, [measurePill, activeId, tabs]);

  // Closing or reordering changes the strip geometry. Suppress the pill
  // transition for one frame so it lands on the new position instead of
  // sliding from a stale one.
  useLayoutEffect(() => {
    const prev = prevIdsRef.current;
    const next = tabs.map((t) => t.id);
    prevIdsRef.current = next;
    if (prev.length === 0) return;
    const removed = prev.some((id) => !next.includes(id));
    const reordered =
      prev.length === next.length && prev.some((id, i) => id !== next[i]);
    if (!removed && !reordered) return;
    setPillMoving(false);
    const raf = requestAnimationFrame(() => setPillMoving(true));
    return () => cancelAnimationFrame(raf);
  }, [tabs]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const ro = new ResizeObserver(measurePill);
    ro.observe(list);
    return () => ro.disconnect();
  }, [measurePill]);

  // Hold the transition off until the pill is first placed, so it never slides
  // in from the origin on mount.
  useEffect(() => {
    if (pill && !pillReady) {
      const id = requestAnimationFrame(() => setPillReady(true));
      return () => cancelAnimationFrame(id);
    }
  }, [pill, pillReady]);

  const gapAtX = (clientX: number) => {
    const els = Array.from(
      scrollRef.current?.querySelectorAll<HTMLElement>("[data-tab-id]") ?? [],
    );
    for (let i = 0; i < els.length; i++) {
      const r = els[i].getBoundingClientRect();
      if (clientX < r.left + r.width / 2) return i;
    }
    return els.length;
  };

  const stopAutoScroll = () => {
    if (autoScrollRef.current.raf !== null) {
      cancelAnimationFrame(autoScrollRef.current.raf);
    }
    autoScrollRef.current = { raf: null, dir: 0, x: 0 };
  };

  const startAutoScroll = () => {
    const st = autoScrollRef.current;
    if (st.raf !== null) return;
    const tick = () => {
      const el = scrollRef.current;
      if (!el || autoScrollRef.current.dir === 0) {
        autoScrollRef.current.raf = null;
        return;
      }
      el.scrollLeft += autoScrollRef.current.dir * 8;
      setDropGap(gapAtX(autoScrollRef.current.x));
      autoScrollRef.current.raf = requestAnimationFrame(tick);
    };
    st.raf = requestAnimationFrame(tick);
  };

  const updateAutoScroll = (clientX: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const edge = 24;
    const dir =
      clientX < rect.left + edge ? -1 : clientX > rect.right - edge ? 1 : 0;
    autoScrollRef.current.dir = dir;
    autoScrollRef.current.x = clientX;
    if (dir === 0) {
      if (autoScrollRef.current.raf !== null) {
        cancelAnimationFrame(autoScrollRef.current.raf);
        autoScrollRef.current.raf = null;
      }
    } else {
      startAutoScroll();
    }
  };

  const scheduleGhost = (x: number, y: number) => {
    ghostPosRef.current = { x, y };
    if (ghostRafRef.current !== null) return;
    ghostRafRef.current = requestAnimationFrame(() => {
      ghostRafRef.current = null;
      const pos = ghostPosRef.current;
      if (!pos) return;
      setGhost((g) => (g ? { ...g, x: pos.x, y: pos.y } : g));
    });
  };

  const clearGhost = () => {
    if (ghostRafRef.current !== null) {
      cancelAnimationFrame(ghostRafRef.current);
      ghostRafRef.current = null;
    }
    ghostPosRef.current = null;
    setGhost(null);
  };

  const endDrag = (currentTarget: HTMLElement) => {
    const st = drag.current;
    if (st) currentTarget.releasePointerCapture?.(st.pointerId);
    drag.current = null;
    setDraggingId(null);
    setDropGap(null);
    stopAutoScroll();
    clearGhost();
    document.body.style.userSelect = "";
  };

  // Horizontal wheel scroll without holding shift.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      if (el.scrollWidth <= el.clientWidth) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Keep the active tab visible after selection / open.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const active = el.querySelector<HTMLElement>(`[data-tab-id="${activeId}"]`);
    active?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeId]);

  useEffect(() => {
    return () => {
      if (ghostRafRef.current !== null) {
        cancelAnimationFrame(ghostRafRef.current);
      }
      if (autoScrollRef.current.raf !== null) {
        cancelAnimationFrame(autoScrollRef.current.raf);
      }
      document.body.style.userSelect = "";
    };
  }, []);

  return (
    <div
      ref={scrollRef}
      data-tauri-drag-region
      className="min-w-0 shrink overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="flex w-max items-center gap-0.5">
        <Tabs
          value={String(activeId)}
          onValueChange={(v) => onSelect(Number(v))}
        >
          <TabsList
            ref={listRef}
            className="relative h-7 w-max gap-0.5 bg-transparent p-0"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute left-0 top-1/2 h-7 rounded-md bg-foreground/[0.07] shadow-sm ring-1 ring-inset ring-foreground/[0.05]"
              style={
                pill
                  ? {
                      width: pill.width,
                      transform: `translate(${pill.left}px, -50%)`,
                      transitionProperty:
                        pillReady && pillMoving ? "transform, width" : "none",
                      transitionDuration: "var(--dur-base)",
                      transitionTimingFunction: "var(--ease-premium)",
                    }
                  : { opacity: 0 }
              }
            />
            {tabs.map((t, i) => {
              const isActive = t.id === activeId;
              const isEntering =
                entering.has(t.id) || !seenRef.current?.has(t.id);
              const tabLabelOptions = { home, homeResolved };
              const terminalStarting = isTerminalLabelResolving(
                t,
                tabLabelOptions,
              );

              const srcIndex = tabs.findIndex((x) => x.id === draggingId);
              const showGap = (gap: number) =>
                draggingId !== null &&
                dropGap === gap &&
                gap !== srcIndex &&
                gap !== srcIndex + 1;

              // While renaming, render a non-button cell so the <input> is not
              // nested inside the trigger <button> (invalid HTML, and WebKit
              // blocks focus/selection on inputs inside buttons).
              if (editingId === t.id) {
                return (
                  <Fragment key={t.id}>
                    {showGap(i) && <DropIndicator />}
                    <div
                      data-tab-id={t.id}
                      className={cn(
                        "flex h-7 shrink-0 items-center gap-1.5 rounded-md bg-accent text-xs text-foreground",
                        compact ? "w-40 px-1.5" : "w-52 px-2",
                      )}
                    >
                      <TabIcon starting={terminalStarting} />
                      <TabRenameInput
                        initial={pathLabelFor(t, tabLabelOptions)}
                        onCommit={(value) => {
                          onRename(t.id, value);
                          setEditingId(null);
                        }}
                        onCancel={() => setEditingId(null)}
                      />
                    </div>
                    {i === tabs.length - 1 && showGap(tabs.length) && (
                      <DropIndicator />
                    )}
                  </Fragment>
                );
              }

              const trigger = (
                <TabsTrigger
                  value={String(t.id)}
                  data-tab-id={t.id}
                  data-tab-active={isActive ? "true" : undefined}
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    if ((e.target as HTMLElement).closest("[data-no-drag]"))
                      return;
                    drag.current = {
                      pointerId: e.pointerId,
                      startX: e.clientX,
                      startY: e.clientY,
                      fromId: t.id,
                      active: false,
                    };
                    e.currentTarget.setPointerCapture(e.pointerId);
                  }}
                  onPointerMove={(e) => {
                    const st = drag.current;
                    if (!st || st.pointerId !== e.pointerId) return;
                    if (!st.active) {
                      if (Math.abs(e.clientX - st.startX) < 4) return;
                      st.active = true;
                      st.rect = e.currentTarget.getBoundingClientRect();
                      setDraggingId(st.fromId);
                      setGhost({
                        tabId: st.fromId,
                        x: st.rect.left,
                        y: st.rect.top,
                        width: st.rect.width,
                        height: st.rect.height,
                      });
                      document.body.style.userSelect = "none";
                    }
                    e.preventDefault();
                    if (st.rect) {
                      scheduleGhost(
                        st.rect.left + (e.clientX - st.startX),
                        st.rect.top + (e.clientY - st.startY),
                      );
                    }
                    updateAutoScroll(e.clientX);
                    setDropGap(gapAtX(e.clientX));
                  }}
                  onPointerUp={(e) => {
                    const st = drag.current;
                    if (st?.active && dropGap !== null) {
                      onReorder(st.fromId, dropGap);
                    } else if (st && !st.active) {
                      onSelect(t.id);
                    }
                    endDrag(e.currentTarget);
                  }}
                  onPointerCancel={(e) => endDrag(e.currentTarget)}
                  onAnimationEnd={(e) => {
                    if (
                      e.target === e.currentTarget &&
                      e.animationName.includes("kite-tab-in")
                    ) {
                      clearEntering(t.id);
                    }
                  }}
                  onAuxClick={(e) => {
                    if (e.button === 1 && tabs.length > 1) {
                      e.preventDefault();
                      e.stopPropagation();
                      onClose(t.id);
                    }
                  }}
                  // Suppress Radix's switch-on-mousedown so a tab grabbed to
                  // drag (or a plain click) only activates on release.
                  onMouseDown={(e) => {
                    if (e.button === 1) {
                      e.preventDefault();
                      return;
                    }
                    if (
                      e.button === 0 &&
                      !(e.target as HTMLElement).closest("[data-no-drag]")
                    ) {
                      e.preventDefault();
                    }
                  }}
                  className={cn(
                    "group relative z-[1] h-7 shrink-0 justify-between gap-1.5 rounded-md bg-transparent text-xs data-active:bg-transparent dark:data-active:bg-transparent",
                    isEntering && "kite-tab-in",
                    terminalStarting && "kite-tab-terminal-resolving",
                    isActive
                      ? "text-foreground dark:text-foreground"
                      : "text-muted-foreground hover:text-foreground/80 dark:text-muted-foreground",
                    draggingId === t.id && "opacity-50",
                    compact
                      ? "w-40 px-1.5!"
                      : tabs.length === 1
                        ? "w-52 px-2!"
                        : "w-52 ps-2! pe-1!",
                  )}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-1.5">
                    <TabIcon starting={terminalStarting} />
                    <TabLabel
                      tab={t}
                      home={home}
                      homeResolved={homeResolved}
                    />
                  </span>
                  {tabs.length > 1 && (
                    <span
                      role="button"
                      aria-label={messages.closeTab}
                      data-no-drag
                      onClick={(e) => {
                        e.stopPropagation();
                        onClose(t.id);
                      }}
                      className="rounded p-0.5 opacity-0 transition-opacity duration-[var(--dur-instant)] ease-[var(--ease-soft)] hover:bg-accent hover:opacity-100 group-hover:opacity-60"
                    >
                      <HugeiconsIcon
                        icon={Cancel01Icon}
                        size={11}
                        strokeWidth={2}
                      />
                    </span>
                  )}
                </TabsTrigger>
              );

              const tabNode = (
                <ContextMenu>
                  <ContextMenuTrigger asChild>{trigger}</ContextMenuTrigger>
                  <ContextMenuContent
                    className="min-w-32 p-1"
                    onCloseAutoFocus={(e) => e.preventDefault()}
                  >
                    <ContextMenuItem
                      className="gap-2 rounded-xl px-2.5 py-1.5 text-[13px]"
                      onSelect={() => setEditingId(t.id)}
                    >
                      <HugeiconsIcon
                        icon={PencilEdit02Icon}
                        size={13}
                        strokeWidth={1.75}
                      />
                      <span className="flex-1">{messages.rename}</span>
                    </ContextMenuItem>
                    {tabs.length > 1 && (
                      <>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          className="gap-2 rounded-xl px-2.5 py-1.5 text-[13px]"
                          onSelect={() => onClose(t.id)}
                        >
                          <HugeiconsIcon
                            icon={Cancel01Icon}
                            size={13}
                            strokeWidth={1.75}
                          />
                          <span className="flex-1">{messages.close}</span>
                        </ContextMenuItem>
                      </>
                    )}
                  </ContextMenuContent>
                </ContextMenu>
              );

              return (
                <Fragment key={t.id}>
                  {showGap(i) && <DropIndicator />}
                  {tabNode}
                  {i === tabs.length - 1 && showGap(tabs.length) && (
                    <DropIndicator />
                  )}
                </Fragment>
              );
            })}
          </TabsList>
        </Tabs>
        <Button
          variant="ghost"
          size="icon"
          onClick={onNew}
          className="size-7 shrink-0 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          title={messages.newTab}
        >
          <HugeiconsIcon icon={PlusSignIcon} size={14} strokeWidth={2} />
        </Button>
      </div>
      {ghost && (() => {
        const gTab = tabs.find((t) => t.id === ghost.tabId);
        if (!gTab) return null;
        const gLabel = pathLabelFor(gTab, { home, homeResolved });
        const gStarting = isTerminalLabelResolving(gTab, {
          home,
          homeResolved,
        });
        return (
          <div
            className="pointer-events-none fixed left-0 top-0 z-[90]"
            style={{
              transform: `translate3d(${ghost.x}px, ${ghost.y}px, 0)`,
              width: ghost.width,
              height: ghost.height,
            }}
          >
            <div className="kite-tab-drag-ghost flex h-full items-center gap-1.5 rounded-md border border-border bg-popover px-2 text-xs text-foreground shadow-2xl ring-1 ring-foreground/5">
              <TabIcon starting={gStarting} />
              <span className="min-w-0 flex-1 truncate">{gLabel}</span>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function DropIndicator() {
  return (
    <span
      aria-hidden
      className="kite-drop-indicator my-0.5 w-0.5 shrink-0 self-stretch rounded-full bg-primary"
    />
  );
}

function TabLabel({
  tab,
  home,
  homeResolved,
}: {
  tab: Tab;
  home?: string | null;
  homeResolved?: boolean;
}) {
  const options = { home, homeResolved };
  const label = pathLabelFor(tab, options);
  const resolving = isTerminalLabelResolving(tab, options);
  const outerRef = useRef<HTMLSpanElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(0);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const measure = () => {
      setOverflow(Math.max(0, Math.ceil(inner.scrollWidth - outer.clientWidth)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(outer);
    ro.observe(inner);
    return () => ro.disconnect();
  }, []);

  const marqueeStyle =
    overflow > 0
      ? ({
          "--kite-tab-label-shift": `-${overflow}px`,
          "--kite-tab-marquee-duration": `${Math.max(2, overflow / 24)}s`,
        } as CSSProperties)
      : undefined;

  return (
    <span
      ref={outerRef}
      title={overflow > 0 ? label : undefined}
      className={cn(
        "block min-w-0 flex-1 overflow-hidden text-left",
        overflow > 0 && "kite-tab-label-mask",
      )}
    >
      <span
        className={cn(
          "kite-tab-label-text inline-block whitespace-nowrap align-bottom",
          resolving && "kite-tab-label-text-loading",
        )}
      >
        <span
          ref={innerRef}
          className={cn(
            "inline-block whitespace-nowrap",
            overflow > 0 && "kite-tab-label-marquee",
          )}
          style={marqueeStyle}
        >
          {label}
        </span>
      </span>
    </span>
  );
}

export function TabIcon({ starting }: { starting?: boolean }) {
  return (
    <HugeiconsIcon
      icon={ComputerTerminal02Icon}
      size={14}
      strokeWidth={2}
      className={cn("shrink-0", starting && "kite-terminal-tab-icon-starting")}
    />
  );
}

function TabRenameInput({
  initial,
  onCommit,
  onCancel,
}: {
  initial: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}) {
  const messages = useMessages().mainShell.tabs;
  const ref = useRef<HTMLInputElement>(null);
  // Guards against a trailing blur re-resolving an edit that Enter/Escape
  // already finished (Escape must never commit).
  const done = useRef(false);

  useEffect(() => {
    // Focus on the next frame so it runs after the context menu restores focus
    // to its trigger when closing; a synchronous focus would be stolen.
    const raf = requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.select();
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const finish = (fn: () => void) => {
    if (done.current) return;
    done.current = true;
    fn();
  };

  // explicit = the user pressed Enter, which pins even the unchanged label. A
  // plain blur with no change must not freeze the cwd-derived default into a
  // custom title.
  const commit = (value: string, explicit: boolean) => {
    if (!explicit && value.trim() === initial.trim()) finish(onCancel);
    else finish(() => onCommit(value));
  };

  return (
    <input
      ref={ref}
      defaultValue={initial}
      aria-label={messages.renameTab}
      className={cn(
        "w-full min-w-0 flex-1 rounded-sm bg-background px-1 text-xs text-foreground",
        "outline-none ring-1 ring-border focus:ring-ring",
      )}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") commit(e.currentTarget.value, true);
        else if (e.key === "Escape") finish(onCancel);
      }}
      onBlur={(e) => {
        // Switching windows/apps blurs the input; keep the edit open instead
        // of resolving it on the way out.
        if (!document.hasFocus()) return;
        commit(e.currentTarget.value, false);
      }}
    />
  );
}

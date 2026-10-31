import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getLaunchDir } from "@/lib/launchDir";
import { useZoom } from "@/lib/useZoom";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { CommandPalette, createCommandItems } from "@/modules/command-palette";
import { useMessages } from "@/modules/i18n";
import { Header } from "@/modules/header";
import { openSettingsWindow } from "@/modules/settings/openSettingsWindow";
import {
  useGlobalShortcuts,
  type ShortcutHandlers,
  type ShortcutId,
} from "@/modules/shortcuts";
import {
  TabSwitcherHud,
  useTabs,
  useTabSwitcher,
  useWindowTitle,
  useWorkspaceCwd,
  type TabColorTag,
} from "@/modules/tabs";
import {
  clearFocusedTerminal,
  disposeSession,
  hasLeaf,
  leafIds,
  type PaneCommand,
  type TerminalPaneHandle,
  useTerminalFileDrop,
} from "@/modules/terminal";
import { equalizePaneTree } from "@/modules/terminal/PaneTreeView";
import {
  listTerminalShells,
  type ShellChoice,
} from "@/modules/terminal/lib/shells";
import { onTerminalActivity } from "@/modules/terminal/lib/terminalActivity";
import {
  deliverTerminalNotification,
  type TerminalNotificationTexts,
} from "@/modules/terminal/lib/terminalNotifications";
import { usePreferencesStore } from "@/modules/settings/preferences";
import { useTabActivityStore } from "@/modules/tabs/lib/tabActivityStore";
import {
  buildTabsFromLayout,
  parseSessionLayout,
  serializeSessionLayout,
} from "@/modules/tabs/lib/sessionLayout";
import { saveSessionLayout, loadSessionLayout } from "@/modules/settings/store";
import { applyQuakePreference } from "@/modules/quake/quake";
import { invoke } from "@tauri-apps/api/core";
import { useTerminalSearchStore } from "@/modules/terminal/lib/terminalSearchStore";
import { PasteGuardDialog } from "@/modules/terminal/PasteGuardDialog";
import { ThemeProvider } from "@/modules/theme";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CloseDialogs } from "./components/CloseDialogs";
import { WorkspaceSurface } from "./components/WorkspaceSurface";
import { useHomeLocation } from "./hooks/useHomeLocation";
import { useTabCloseGuards } from "./hooks/useTabCloseGuards";

/** Compact wall-clock duration for command-finished notifications (7.2s, 44s, 2m 05s). */
function formatCommandDuration(ms: number): string {
  if (ms < 0) ms = 0;
  if (ms < 10_000) return `${(ms / 1000).toFixed(1)}s`;
  const total = Math.round(ms / 1000);
  if (total < 60) return `${total}s`;
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, "0");
  return `${m}m ${s}s`;
}

export default function App() {
  const messages = useMessages();
  const initialLaunchDir = getLaunchDir();
  const {
    tabs,
    activeId,
    setActiveId,
    reorderTabByGap,
    markBooted,
    newTab,
    closeTab,
    updateTab,
    selectByIndex,
    setLeafCwd,
    focusPane,
    focusNextPaneInTab,
    splitActivePane,
    closeActivePane,
    closePaneByLeaf,
    resetWorkspace,
    toggleZoomPane,
    booted,
    allocId,
    replaceTabs,
  } = useTabs(initialLaunchDir ? { cwd: initialLaunchDir } : undefined);

  // Mirror `tabs` into a ref so callbacks scheduled with `setTimeout`
  // (e.g. cdInNewTab) read the latest pane state instead of a stale closure.
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

  const terminalRefs = useRef<Map<number, TerminalPaneHandle>>(new Map());
  const { zoomIn, zoomOut, zoomReset } = useZoom();
  useTerminalFileDrop();

  // Drives session disposal off the pane tree, not React lifecycles —
  // split/unsplit re-mount components but the leaf is still live.
  const liveLeavesRef = useRef<Set<number>>(new Set());

  const clearWorkspaceState = useCallback(() => {
    for (const id of liveLeavesRef.current) disposeSession(id);
    terminalRefs.current.clear();
  }, []);

  const { home, homeResolved, launchCwd, openLaunchDir } = useHomeLocation({
    resetWorkspace,
    clearWorkspaceState,
  });

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | null = null;

    void listen<string>("kite:open-launch-dir", (event) => {
      openLaunchDir(event.payload);
    }).then((dispose) => {
      if (disposed) {
        dispose();
      } else {
        unlisten = dispose;
      }
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [openLaunchDir]);

  useEffect(() => {
    if (launchCwd !== null || homeResolved) {
      markBooted();
    }
  }, [launchCwd, homeResolved, markBooted]);

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [shellChoices, setShellChoices] = useState<ShellChoice[]>([]);
  useEffect(() => {
    if (!commandPaletteOpen || shellChoices.length > 0) return;
    let cancelled = false;
    void listTerminalShells().then((list) => {
      if (!cancelled) setShellChoices(list);
    });
    return () => {
      cancelled = true;
    };
  }, [commandPaletteOpen, shellChoices.length]);
  const openCommandPalette = useCallback(() => {
    setCommandPaletteOpen(true);
  }, []);
  const activeTab = tabs.find((t) => t.id === activeId);

  const { workspaceRoot, inheritedCwdForNewTab } = useWorkspaceCwd(
    activeTab,
    tabs,
    launchCwd ?? home,
  );

  useWindowTitle(activeTab, workspaceRoot, home, homeResolved);

  const {
    pendingTerminalCloseTab,
    handleClose,
    confirmTerminalClose,
    cancelTerminalClose,
  } = useTabCloseGuards({ tabs, disposeTab: closeTab });

  useEffect(() => {
    const live = new Set<number>();
    for (const t of tabs) {
      for (const id of leafIds(t.paneTree)) live.add(id);
    }
    for (const id of liveLeavesRef.current) {
      if (!live.has(id)) disposeSession(id);
    }
    liveLeavesRef.current = live;
    for (const k of [...terminalRefs.current.keys()])
      if (!live.has(k)) terminalRefs.current.delete(k);
  }, [tabs]);

  // Most-recently-used tab ids, most recent first, pruned to live tabs. Drives
  // the Ctrl+Tab quick switcher so it cycles by recency, not strip order.
  const mruRef = useRef<number[]>([activeId]);
  useEffect(() => {
    mruRef.current = [
      activeId,
      ...mruRef.current.filter((id) => id !== activeId),
    ];
  }, [activeId]);
  useEffect(() => {
    const live = new Set(tabs.map((t) => t.id));
    mruRef.current = mruRef.current.filter((id) => live.has(id));
  }, [tabs]);

  const getSwitcherOrder = useCallback(() => {
    const all = tabsRef.current.map((t) => t.id);
    const present = new Set(all);
    const ordered = mruRef.current.filter((id) => present.has(id));
    for (const id of all) if (!ordered.includes(id)) ordered.push(id);
    return [activeId, ...ordered.filter((id) => id !== activeId)];
  }, [activeId]);

  const { state: switcherState, step: stepSwitcher } = useTabSwitcher({
    getOrder: getSwitcherOrder,
    onCommit: (id) => {
      if (tabsRef.current.some((t) => t.id === id)) setActiveId(id);
    },
  });

  const openNewTab = useCallback(() => {
    newTab(inheritedCwdForNewTab());
  }, [newTab, inheritedCwdForNewTab]);

  const openNewTabWithShell = useCallback(
    (shell: ShellChoice) => {
      newTab(inheritedCwdForNewTab(), shell.path);
    },
    [newTab, inheritedCwdForNewTab],
  );

  // Secondary windows spawn with the active tab's cwd in the URL query.
  const openNewWindow = useCallback(() => {
    const cwd = tabsRef.current.find((t) => t.id === activeIdRef.current)?.cwd;
    void invoke("open_new_window", { cwd: cwd ?? null }).catch((e) =>
      console.error("[kite] open_new_window failed:", e),
    );
  }, []);

  // Notification wording is resolved through the i18n bundle once here so the
  // non-React delivery path stays free of message lookups.
  const notificationTexts = useMemo<TerminalNotificationTexts>(
    () => ({
      appTitle: "Kite",
      bellFallback: messages.mainShell.notifications.bellFallback,
      commandFinished: messages.mainShell.notifications.commandFinished,
    }),
    [messages],
  );

  const toggleZoomInActiveTab = useCallback(() => {
    toggleZoomPane(activeId);
  }, [activeId, toggleZoomPane]);

  const equalizeActiveTabPanes = useCallback(() => {
    const t = tabsRef.current.find((x) => x.id === activeId);
    if (t?.kind === "terminal") equalizePaneTree(t.paneTree);
  }, [activeId]);

  // Terminal activity: badge background tabs with output, track per-leaf
  // command state for the tab indicators, and deliver bell / command-finished
  // notifications when the user is not watching the pane.
  useEffect(() => {
    const { markActive, setLeafWorking, setLeafFinished, clearLeafState } =
      useTabActivityStore.getState();
    return onTerminalActivity((activity) => {
      // Presence, not notification: the OSC 133 C..D window drives the tab
      // states (working dot + sweeping label + running command line; a
      // background finish lands as done/failed). Tracked before the tab
      // lookup so a stale leaf id from a disposed session is harmless.
      if (activity.kind === "commandState") {
        if (activity.running === true) {
          setLeafWorking(activity.leafId, activity.cmdline);
        } else if (activity.exitCode != null) {
          // A real OSC 133 D finish: only a background tab needs the dot,
          // the user is already looking at an active one.
          const tab = tabsRef.current.find(
            (t) =>
              t.kind === "terminal" && hasLeaf(t.paneTree, activity.leafId),
          );
          if (tab && tab.id !== activeIdRef.current) {
            setLeafFinished(activity.leafId, activity.exitCode !== 0);
          } else {
            clearLeafState(activity.leafId);
          }
        } else {
          // Tear-down path (dispose, respawn, shell exit): no finish to show.
          clearLeafState(activity.leafId);
        }
        return;
      }
      const tab = tabsRef.current.find(
        (t) =>
          t.kind === "terminal" && hasLeaf(t.paneTree, activity.leafId),
      );
      if (!tab) return;
      if (activity.kind === "output") {
        if (tab.id !== activeIdRef.current) markActive(tab.id);
        return;
      }
      if (activity.kind === "commandFinished") {
        const detail =
          activity.cmdline && activity.exitCode != null
            ? messages.mainShell.notifications.commandFinishedDetail(
                activity.cmdline,
                activity.exitCode,
                formatCommandDuration(activity.durationMs ?? 0),
              )
            : undefined;
        deliverTerminalNotification(
          activity.kind,
          {
            windowFocused: document.hasFocus(),
            tabActive: tab.id === activeIdRef.current,
          },
          notificationTexts,
          detail,
        );
        return;
      }
      deliverTerminalNotification(
        activity.kind,
        {
          windowFocused: document.hasFocus(),
          tabActive: tab.id === activeIdRef.current,
        },
        notificationTexts,
        activity.message,
      );
    });
  }, [notificationTexts, messages]);

  // Switching to a tab acknowledges its activity dot and any done/failed
  // command states on its leaves — seeing them counts as reading them.
  useEffect(() => {
    const store = useTabActivityStore.getState();
    store.clear(activeId);
    const t = tabsRef.current.find((x) => x.id === activeId);
    if (t?.kind === "terminal") {
      for (const leafId of leafIds(t.paneTree)) store.clearLeafState(leafId);
    }
  }, [activeId]);

  // Quake global hotkey follows the preference (register/unregister).
  const quakeEnabled = usePreferencesStore((s) => s.quakeEnabled);
  useEffect(() => {
    void applyQuakePreference(quakeEnabled);
  }, [quakeEnabled]);

  // Session restore runs once, before the first tab warms: an explicit launch
  // directory means the user asked to open a folder, so skip the layout.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    const prefs = usePreferencesStore.getState();
    if (!prefs.hydrated) return;
    restoredRef.current = true;
    if (!prefs.sessionRestore || initialLaunchDir) return;
    void loadSessionLayout()
      .then((raw) => {
        const layout = parseSessionLayout(raw);
        if (!layout) return;
        const built = buildTabsFromLayout(layout, allocId);
        replaceTabs(built.tabs, built.activeId);
      })
      .catch((e) => console.warn("[kite] session restore failed:", e));
  }, [allocId, replaceTabs, initialLaunchDir]);

  // Persist the layout (structure, cwd, shell — not buffer contents) behind a
  // short debounce; OSC 7 cwd updates already bail out of setTabs when idle.
  // tabs/activeId are deliberate re-save signals; refs inside read the latest.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional re-save triggers
  useEffect(() => {
    if (!booted) return;
    if (!usePreferencesStore.getState().sessionRestore) return;
    const timer = setTimeout(() => {
      const layout = serializeSessionLayout(
        tabsRef.current,
        activeIdRef.current,
      );
      if (layout) void saveSessionLayout(layout);
    }, 800);
    return () => clearTimeout(timer);
  }, [tabs, activeId, booted]);

  const splitActivePaneInActiveTab = useCallback(
    (dir: "row" | "col") => {
      const t = tabsRef.current.find((x) => x.id === activeId);
      if (t?.kind !== "terminal") return;
      splitActivePane(activeId, dir);
    },
    [activeId, splitActivePane],
  );

  const handleCloseTabOrPane = useCallback(() => {
    const t = tabsRef.current.find((x) => x.id === activeId);
    if (t?.kind === "terminal" && leafIds(t.paneTree).length > 1) {
      closeActivePane(activeId);
      return;
    }
    void handleClose(activeId);
  }, [activeId, closeActivePane, handleClose]);

  // Pane context-menu commands. Reads the tab set from the ref so the menu can
  // act on the pane it was opened on, even before its focus change settles.
  const handlePaneCommand = useCallback(
    (leafId: number, command: PaneCommand) => {
      const tab = tabsRef.current.find(
        (t) => t.kind === "terminal" && hasLeaf(t.paneTree, leafId),
      );
      if (tab?.kind !== "terminal") return;
      if (command === "close") {
        if (leafIds(tab.paneTree).length > 1) {
          closePaneByLeaf(leafId);
          return;
        }
        void handleClose(tab.id);
        return;
      }
      if (command === "zoom") {
        toggleZoomPane(tab.id, leafId);
        return;
      }
      if (command === "equalize") {
        equalizePaneTree(tab.paneTree);
        return;
      }
      focusPane(tab.id, leafId);
      splitActivePane(tab.id, command === "splitRight" ? "row" : "col");
    },
    [closePaneByLeaf, handleClose, focusPane, splitActivePane, toggleZoomPane],
  );

  const [zenMode, setZenMode] = useState(false);

  const shortcutHandlers = useMemo<ShortcutHandlers>(
    () => ({
      "commandPalette.open": openCommandPalette,
      "window.new": openNewWindow,
      "tab.new": openNewTab,
      "tab.close": handleCloseTabOrPane,
      "tab.next": () => stepSwitcher(1),
      "tab.prev": () => stepSwitcher(-1),
      "tab.selectByIndex": (e) => selectByIndex(parseInt(e.key, 10) - 1),
      "pane.splitRight": () => splitActivePaneInActiveTab("row"),
      "pane.splitDown": () => splitActivePaneInActiveTab("col"),
      "pane.focusNext": () => focusNextPaneInTab(activeId, 1),
      "pane.focusPrev": () => focusNextPaneInTab(activeId, -1),
      "pane.toggleZoom": toggleZoomInActiveTab,
      "terminal.clear": () => {
        clearFocusedTerminal();
      },
      "terminal.find": () => {
        const search = useTerminalSearchStore.getState();
        if (search.open) search.closeSearch();
        else search.openSearch();
      },
      "settings.open": () => void openSettingsWindow(),
      "view.zoomIn": zoomIn,
      "view.zoomOut": zoomOut,
      "view.zoomReset": zoomReset,
      "view.zenMode": () => setZenMode((v) => !v),
    }),
    [
      activeId,
      openCommandPalette,
      openNewWindow,
      stepSwitcher,
      handleCloseTabOrPane,
      openNewTab,
      selectByIndex,
      splitActivePaneInActiveTab,
      focusNextPaneInTab,
      toggleZoomInActiveTab,
      zoomIn,
      zoomOut,
      zoomReset,
    ],
  );

  const shortcutsDisabled = useCallback((id: ShortcutId, e: KeyboardEvent) => {
    if (id === "terminal.clear") {
      // Only intercept ⌘K while a terminal is focused; elsewhere let the key
      // fall through (we never preventDefault when disabled).
      const target = (e.target as HTMLElement | null) ?? document.activeElement;
      return !(target as HTMLElement | null)?.closest?.(".xterm");
    }
    if (id === "terminal.find") {
      // Always findable from the terminal; in other editable surfaces (palette,
      // rename) Ctrl+F keeps its native meaning instead of toggling the bar.
      const target = (e.target as HTMLElement | null) ?? document.activeElement;
      if (target?.closest?.(".xterm")) return false;
      return (
        !!target?.closest?.("input, textarea, [contenteditable]") &&
        !target?.closest?.("[data-kite-terminal-search]")
      );
    }
    return false;
  }, []);

  useGlobalShortcuts(shortcutHandlers, { isDisabled: shortcutsDisabled });

  const registerTerminalHandle = useCallback(
    (leafId: number, h: TerminalPaneHandle | null) => {
      if (h) terminalRefs.current.set(leafId, h);
      else terminalRefs.current.delete(leafId);
    },
    [],
  );

  const handleTerminalCwd = useCallback(
    (leafId: number, cwd: string) => {
      setLeafCwd(leafId, cwd);
    },
    [setLeafCwd],
  );

  const handleFocusLeaf = useCallback(
    (tabId: number, leafId: number) => focusPane(tabId, leafId),
    [focusPane],
  );

  const handleLeafExit = useCallback(
    (leafId: number, _code: number) => {
      const all = tabsRef.current;
      const tab = all.find(
        (t) => t.kind === "terminal" && hasLeaf(t.paneTree, leafId),
      );
      if (tab?.kind !== "terminal") return;
      // Last pane of the last tab: quit instead of respawning a shell.
      if (leafIds(tab.paneTree).length === 1 && all.length === 1) {
        void getCurrentWindow().close();
      } else {
        closePaneByLeaf(leafId);
      }
    },
    [closePaneByLeaf],
  );

  const handleRenameTab = useCallback(
    (id: number, title: string) => updateTab(id, { customTitle: title.trim() }),
    [updateTab],
  );

  const handleSetColorTab = useCallback(
    (id: number, color: TabColorTag | "") => updateTab(id, { colorTag: color }),
    [updateTab],
  );

  const commandPaletteItems = useMemo(
    () =>
      commandPaletteOpen
        ? createCommandItems(
            {
              tabs,
              activeId,
              openNewTab,
              openNewWindow,
              closeActiveTabOrPane: handleCloseTabOrPane,
              splitPaneRight: () => splitActivePaneInActiveTab("row"),
              splitPaneDown: () => splitActivePaneInActiveTab("col"),
              toggleZoomPane: toggleZoomInActiveTab,
              equalizePanes: equalizeActiveTabPanes,
              openSettings: () => void openSettingsWindow(),
              openKeyboardShortcuts: () => void openSettingsWindow("shortcuts"),
            },
            messages.mainShell.commandPalette,
          )
        : [],
    [
      commandPaletteOpen,
      tabs,
      activeId,
      openNewTab,
      openNewWindow,
      handleCloseTabOrPane,
      splitActivePaneInActiveTab,
      toggleZoomInActiveTab,
      equalizeActiveTabPanes,
      messages,
    ],
  );

  const shell = (
    <ThemeProvider>
      <TooltipProvider>
        <div className="relative flex h-screen flex-col overflow-hidden bg-background text-foreground">
          {!zenMode && (
            <Header
              tabs={tabs}
              activeId={activeId}
              onSelect={setActiveId}
              onNew={openNewTab}
              onClose={handleClose}
              onRename={handleRenameTab}
              onSetColor={handleSetColorTab}
              onReorder={reorderTabByGap}
              onOpenCommandPalette={openCommandPalette}
              onOpenSettings={() => void openSettingsWindow()}
              home={home}
              homeResolved={homeResolved}
            />
          )}

          <main className="zoom-content flex min-h-0 flex-1 flex-col">
            <div className="relative min-h-0 flex-1">
              <WorkspaceSurface
                tabs={tabs}
                activeId={activeId}
                registerTerminalHandle={registerTerminalHandle}
                onCwd={handleTerminalCwd}
                onExit={handleLeafExit}
                onFocusLeaf={handleFocusLeaf}
                onPaneCommand={handlePaneCommand}
              />
            </div>
          </main>

          <Toaster position="bottom-right" />

          {switcherState && (
            <TabSwitcherHud
              tabs={tabs}
              state={switcherState}
              home={home}
              homeResolved={homeResolved}
            />
          )}

          <CommandPalette
            open={commandPaletteOpen}
            onOpenChange={setCommandPaletteOpen}
            commandItems={commandPaletteItems}
            shellChoices={shellChoices}
            onNewTerminalWithShell={openNewTabWithShell}
          />

          <CloseDialogs
            pendingTerminalCloseTab={pendingTerminalCloseTab}
            onCancelTerminalClose={cancelTerminalClose}
            onConfirmTerminalClose={confirmTerminalClose}
          />

          <PasteGuardDialog />
        </div>
      </TooltipProvider>
    </ThemeProvider>
  );

  return shell;
}

import { isMarkdownPath } from "@/lib/utils";
import {
  findLeafCwd,
  hasLeaf,
  leafIds,
  nextLeafId,
  type PaneNode,
  removeLeaf,
  type SplitDir,
  setLeafCwd as setLeafCwdInTree,
  siblingLeafOf,
  splitLeaf,
} from "@/modules/terminal/lib/panes";
import { disposeSession } from "@/modules/terminal/lib/useTerminalSession";
import { useCallback, useEffect, useRef, useState } from "react";

// Matches the renderer slot pool size — over this we'd evict an active leaf.
export const MAX_PANES_PER_TAB = 4;

type TabBase = {
  /** Restored from disk, not yet activated: rendered as a placeholder, not mounted. */
  cold?: boolean;
};

export type TerminalTab = TabBase & {
  id: number;
  kind: "terminal";
  title: string;
  cwd?: string;
  paneTree: PaneNode;
  activeLeafId: number;
  blocks?: boolean;
  /** User-set label that overrides the cwd-derived name. Survives cd. */
  customTitle?: string;
};

export type EditorTab = TabBase & {
  id: number;
  kind: "editor";
  title: string;
  path: string;
  dirty: boolean;
  /**
   * True while the tab is in the transient "preview" state — opened by a
   * single-click in the explorer and not yet pinned by the user. A preview tab
   * is replaced by the next single-click rather than accumulating.
   */
  preview: boolean;
  overrideLanguage?: string | null;
};


export type MarkdownTab = TabBase & {
  id: number;
  kind: "markdown";
  title: string;
  path: string;
};

export type GitDiffTab = TabBase & {
  id: number;
  kind: "git-diff";
  title: string;
  path: string;
  repoRoot: string;
  mode: "-" | "+";
  originalPath: string | null;
};

export type GitHistoryTab = TabBase & {
  id: number;
  kind: "git-history";
  title: string;
  repoRoot: string;
};

export type GitCommitFileDiffTab = TabBase & {
  id: number;
  kind: "git-commit-file";
  title: string;
  repoRoot: string;
  sha: string;
  shortSha: string;
  subject: string;
  path: string;
  originalPath: string | null;
};

export type SftpTab = TabBase & {
  id: number;
  kind: "sftp";
  title: string;
  localPath?: string;
};

export type Tab =
  | TerminalTab
  | EditorTab
  | MarkdownTab
  | GitDiffTab
  | GitHistoryTab
  | GitCommitFileDiffTab
  | SftpTab;

export type TabPatch = Partial<{
  title: string;
  cwd: string;
  path: string;
  dirty: boolean;
  url: string;
  /** Empty string resets a terminal tab to its cwd-derived name. */
  customTitle: string;
  overrideLanguage: string | null;
}>;

function basename(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : path;
}

export const DEFAULT_SPACE_ID = "default";

// Returns the tab at position `idx` within the given space, or undefined when
export function pickTabBySpaceIndex(
  tabs: Tab[],
  idx: number,
  _spaceId?: string,
): Tab | undefined {
  return tabs[idx];
}

export function nextActiveInSpace(
  tabs: Tab[],
  closingId: number,
): number | null {
  if (tabs.length <= 1) return null;
  const idx = tabs.findIndex((t) => t.id === closingId);
  if (idx === -1) return null;
  return (tabs[idx - 1] ?? tabs[idx + 1]).id;
}

export function reorderTabsByGap(
  tabs: Tab[],
  fromId: number,
  toGapIndex: number,
): Tab[] {
  const fromIndex = tabs.findIndex((t) => t.id === fromId);
  if (fromIndex === -1) return tabs;
  const moved = tabs[fromIndex];
  let target = toGapIndex > fromIndex ? toGapIndex - 1 : toGapIndex;
  target = Math.max(0, Math.min(target, tabs.length - 1));
  if (target === fromIndex) return tabs;
  const next = tabs.filter((t) => t.id !== fromId);
  next.splice(target, 0, moved);
  return next;
}

export function useTabs(initial?: Partial<TerminalTab>) {
  const [tabs, setTabs] = useState<Tab[]>(() => {
    const tabId = 1;
    const leafId = 2;
    return [
      {
        id: tabId,
        kind: "terminal",
        cold: true,
        title: initial?.title ?? "shell",
        cwd: initial?.cwd,
        paneTree: { kind: "leaf", id: leafId, cwd: initial?.cwd },
        activeLeafId: leafId,
      },
    ];
  });
  const [activeId, setActiveId] = useState(1);
  // Gates warming until boot resolves the restore, so no shell spawns before it.
  const [booted, setBooted] = useState(false);
  const nextIdRef = useRef(3);  const tabsRef = useRef(tabs);
  const activeIdRef = useRef(activeId);

  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  // Activating a cold tab warms it: one choke point for every activation path.
  useEffect(() => {
    if (!booted) return;
    setTabs((curr) => {
      const t = curr.find((x) => x.id === activeId);
      if (!t?.cold) return curr;
      return curr.map((x) => (x.id === activeId ? { ...x, cold: false } : x));
    });
  }, [activeId, booted]);

  const allocId = useCallback(() => nextIdRef.current++, []);

  const markBooted = useCallback(() => setBooted(true), []);

  const replaceTabs = useCallback((next: Tab[], nextActiveId: number) => {
    if (next.length === 0) return;
    setTabs(next);
    setActiveId(nextActiveId);
  }, []);

  const reorderTab = useCallback(
    (tabId: number, targetTabId: number, edge: "top" | "bottom"): boolean => {
      if (tabId === targetTabId) return false;
      const curr = tabsRef.current;
      const moved = curr.find((t) => t.id === tabId);
      const target = curr.find((t) => t.id === targetTabId);
      if (!moved || !target) return false;
      setTabs((prev) => {
        const without = prev.filter((t) => t.id !== tabId);
        let idx = without.findIndex((t) => t.id === targetTabId);
        if (idx < 0) return prev;
        if (edge === "bottom") idx += 1;
        without.splice(idx, 0, moved);
        return without;
      });
      return false;
    },
    [],
  );

  const newTab = useCallback((cwd?: string) => {
    const tabId = nextIdRef.current++;
    const leafId = nextIdRef.current++;
    setTabs((t) => [
      ...t,
      {
        id: tabId,
        kind: "terminal",
        title: "shell",
        cwd,
        paneTree: { kind: "leaf", id: leafId, cwd },
        activeLeafId: leafId,
      },
    ]);
    setActiveId(tabId);
    return tabId;
  }, []);

  const newBlockTab = useCallback((cwd?: string) => {
    const tabId = nextIdRef.current++;
    const leafId = nextIdRef.current++;
    setTabs((t) => [
      ...t,
      {
        id: tabId,
        kind: "terminal",
        title: "blocks",
        cwd,
        paneTree: { kind: "leaf", id: leafId, cwd },
        activeLeafId: leafId,
        blocks: true,
      },
    ]);
    setActiveId(tabId);
    return tabId;
  }, []);

  useEffect(() => {
    if (!import.meta.env?.DEV || typeof window === "undefined") return;
    (
      window as unknown as { __teraxNewBlockTab?: (cwd?: string) => number }
    ).__teraxNewBlockTab = newBlockTab;
  }, [newBlockTab]);

  /**
   * Opens a file in an editor tab.
   *
   * - `pin = true` (default) — opens or activates a **persistent** tab.
   *   If the path is currently in the preview slot it is promoted in-place.
   *   Use this for programmatic opens (AI diff, New File dialog, etc.).
   * - `pin = false` — VSCode-style **preview** tab. A single shared slot is
   *   reused: if a persistent tab for the path already exists it is activated;
   *   otherwise the current preview slot is replaced with the new path.
   */
  const openFileTab = useCallback((path: string, pin = true) => {
    let targetId: number | null = null;
    setTabs((curr) => {
      if (pin) {
        // Persistent open: find any existing editor tab, pin it if needed.
        const existing = curr.find(
          (t) => t.kind === "editor" && t.path === path,
        );
        if (existing) {
          targetId = existing.id;
          if ((existing as EditorTab).preview) {
            return curr.map((t) =>
              t.id === existing.id ? { ...t, preview: false } : t,
            );
          }
          return curr;
        }
        const id = nextIdRef.current++;
        targetId = id;
        return [
          ...curr,
          {
            id,
            kind: "editor",
            title: basename(path),
            path,
            dirty: false,
            preview: false,
          } satisfies EditorTab,
        ];
      } else {
        // Preview open: persistent tab for this path takes priority.
        const persistent = curr.find(
          (t) =>
            t.kind === "editor" && t.path === path && !(t as EditorTab).preview,
        );
        if (persistent) {
          targetId = persistent.id;
          return curr;
        }
        // Reuse the slot if it already shows the same path.
        const existingPreview = curr.find(
          (t) =>
            t.kind === "editor" && t.path === path && (t as EditorTab).preview,
        );
        if (existingPreview) {
          targetId = existingPreview.id;
          return curr;
        }
        // Replace the current preview slot, or append a new one.
        const previewIdx = curr.findIndex(
          (t) => t.kind === "editor" && (t as EditorTab).preview,
        );
        const id = nextIdRef.current++;
        targetId = id;
        const tab: EditorTab = {
          id,
          kind: "editor",
          title: basename(path),
          path,
          dirty: false,
          preview: true,
        };
        if (previewIdx === -1) return [...curr, tab];
        const next = [...curr];
        next[previewIdx] = tab;
        return next;
      }
    });
    if (targetId !== null) setActiveId(targetId);
    return targetId as number | null;
  }, []);

  /**
   * Promotes a preview tab to a persistent one. Called on double-click of the
   * tab title in the tab bar. Dirty edits also auto-promote (see `updateTab`).
   */
  const pinTab = useCallback((id: number) => {
    setTabs((curr) =>
      curr.map((t) =>
        t.id === id && t.kind === "editor" ? { ...t, preview: false } : t,
      ),
    );
  }, []);

  const newMarkdownTab = useCallback((path: string) => {
    let targetId: number | null = null;
    setTabs((curr) => {
      const existing = curr.find(
        (t) => t.kind === "markdown" && t.path === path,
      );
      if (existing) {
        targetId = existing.id;
        return curr;
      }
      const id = nextIdRef.current++;
      targetId = id;
      return [
        ...curr,
        {
          id,
          kind: "markdown",
          title: basename(path),
          path,
        },
      ];
    });
    if (targetId !== null) setActiveId(targetId);
    return targetId;
  }, []);

  const newSftpTab = useCallback((localPath?: string) => {
    const id = nextIdRef.current++;
    setTabs((t) => [
      ...t,
      {
        id,
        kind: "sftp",
        title: "SFTP",
        localPath,
      },
    ]);
    setActiveId(id);
    return id;
  }, []);

  const setOverrideLanguage = useCallback((id: number, lang: string | null) => {
    setTabs((curr) =>
      curr.map((t) => {
        if (t.id !== id || t.kind !== "editor") return t;
        return {
          ...t,
          overrideLanguage: lang,
        };
      }),
    );
  }, []);

  const setMarkdownView = useCallback(
    (id: number, mode: "rendered" | "raw") => {
      setTabs((curr) =>
        curr.map((t) => {
          if (
            t.id !== id ||
            !isMarkdownPath((t as { path?: string }).path ?? "")
          )
            return t;
          if (mode === "raw" && t.kind === "markdown") {
            return {
              ...t,
              kind: "editor" as const,
              dirty: false,
              preview: false,
              overrideLanguage:
                (t as { overrideLanguage?: string | null }).overrideLanguage ??
                null,
            };
          }
          if (mode === "rendered" && t.kind === "editor") {
            if (t.dirty) return t;
            return {
              id: t.id,
              kind: "markdown" as const,
              cold: t.cold,
              title: t.title,
              path: t.path,
              overrideLanguage: t.overrideLanguage ?? null,
            };
          }
          return t;
        }),
      );
    },
    [],
  );

  const openGitDiffTab = useCallback(
    (input: {
      path: string;
      repoRoot: string;
      mode: "-" | "+";
      originalPath?: string | null;
      title?: string;
    }) => {
      const curr = tabsRef.current;
      const existing = curr.find(
        (t) =>
          t.kind === "git-diff" &&
          t.repoRoot === input.repoRoot &&
          t.path === input.path &&
          t.mode === input.mode,
      );
      const computedTitle =
        input.title ?? `${basename(input.path)} (${input.mode})`;
      const originalPath = input.originalPath ?? null;

      if (existing) {
        const nextTabs = curr.map((t) =>
          t.id === existing.id
            ? { ...t, title: computedTitle, originalPath }
            : t,
        );
        tabsRef.current = nextTabs;
        setTabs(nextTabs);
        setActiveId(existing.id);
        return existing.id;
      }

      const id = nextIdRef.current++;
      const nextTabs = [
        ...curr,
        {
          id,
          kind: "git-diff",
          title: computedTitle,
          path: input.path,
          repoRoot: input.repoRoot,
          mode: input.mode,
          originalPath,
        } satisfies GitDiffTab,
      ];
      tabsRef.current = nextTabs;
      setTabs(nextTabs);
      setActiveId(id);
      return id;
    },
    [],
  );

  const openCommitHistoryTab = useCallback(
    (input: { repoRoot: string; branch?: string | null }) => {
      const curr = tabsRef.current;
      const existing = curr.find(
        (t) => t.kind === "git-history" && t.repoRoot === input.repoRoot,
      );
      const title = input.branch ? `History · ${input.branch}` : "Git History";
      if (existing) {
        const nextTabs = curr.map((t) =>
          t.id === existing.id ? { ...t, title } : t,
        );
        tabsRef.current = nextTabs;
        setTabs(nextTabs);
        setActiveId(existing.id);
        return existing.id;
      }
      const id = nextIdRef.current++;
      const nextTabs = [
        ...curr,
        {
          id,
          kind: "git-history",
          title,
          repoRoot: input.repoRoot,
        } satisfies GitHistoryTab,
      ];
      tabsRef.current = nextTabs;
      setTabs(nextTabs);
      setActiveId(id);
      return id;
    },
    [],
  );

  const openCommitFileDiffTab = useCallback(
    (input: {
      repoRoot: string;
      sha: string;
      shortSha: string;
      subject: string;
      path: string;
      originalPath: string | null;
    }) => {
      const curr = tabsRef.current;
      const existing = curr.find(
        (t) =>
          t.kind === "git-commit-file" &&
          t.repoRoot === input.repoRoot &&
          t.sha === input.sha &&
          t.path === input.path,
      );
      const title = `${basename(input.path)} @ ${input.shortSha}`;
      if (existing) {
        const nextTabs = curr.map((t) =>
          t.id === existing.id
            ? {
                ...t,
                title,
                subject: input.subject,
                originalPath: input.originalPath,
              }
            : t,
        );
        tabsRef.current = nextTabs;
        setTabs(nextTabs);
        setActiveId(existing.id);
        return existing.id;
      }
      const id = nextIdRef.current++;
      const nextTabs = [
        ...curr,
        {
          id,
          kind: "git-commit-file",
          title,
          repoRoot: input.repoRoot,
          sha: input.sha,
          shortSha: input.shortSha,
          subject: input.subject,
          path: input.path,
          originalPath: input.originalPath,
        } satisfies GitCommitFileDiffTab,
      ];
      tabsRef.current = nextTabs;
      setTabs(nextTabs);
      setActiveId(id);
      return id;
    },
    [],
  );

  const closeTab = useCallback((id: number) => {
    let toDispose: number[] = [];
    setTabs((curr) => {
      const fallback = nextActiveInSpace(curr, id);
      if (fallback === null) return curr;
      const target = curr.find((t) => t.id === id);
      if (target?.kind === "terminal") {
        toDispose = leafIds(target.paneTree);
      }
      const next = curr.filter((t) => t.id !== id);
      setActiveId((active) => (id === active ? fallback : active));
      return next;
    });
    for (const lid of toDispose) disposeSession(lid);
  }, []);

  const updateTab = useCallback((id: number, patch: TabPatch) => {
    setTabs((t) =>
      t.map((x) => {
        if (x.id !== id) return x;
        if (x.kind === "terminal") {
          return {
            ...x,
            ...(patch.title !== undefined && { title: patch.title }),
            ...(patch.cwd !== undefined && { cwd: patch.cwd }),
            ...(patch.customTitle !== undefined && {
              customTitle:
                patch.customTitle === "" ? undefined : patch.customTitle,
            }),
          };
        }
        if (x.kind === "markdown") {
          return {
            ...x,
            ...(patch.title !== undefined && { title: patch.title }),
          };
        }
        // editor tab: auto-promote from preview the moment the file becomes dirty.
        const autoPin =
          patch.dirty === true && (x as EditorTab).preview
            ? { preview: false }
            : {};
        return {
          ...x,
          ...autoPin,
          ...(patch.title !== undefined && { title: patch.title }),
          ...(patch.dirty !== undefined && { dirty: patch.dirty }),
          ...(patch.path !== undefined && { path: patch.path }),
          ...(patch.overrideLanguage !== undefined && {
            overrideLanguage: patch.overrideLanguage,
          }),
        };
      }),
    );
  }, []);

  const selectByIndex = useCallback(
    (idx: number) => {
      const t = tabs[idx];
      if (t) setActiveId(t.id);
    },
    [tabs],
  );

  /** Update a leaf's cwd; mirror to the tab's `cwd` when the leaf is active.
   * Bails out without setTabs when nothing actually changed — shell integration
   * re-emits OSC 7 on every prompt, including empty Enters, so this fires at
   * keystroke rate. Always-setTabs there cascades a paneTree re-render across
   * every open tab. */
  const setLeafCwd = useCallback((leafId: number, cwd: string) => {
    setTabs((curr) => {
      let changed = false;
      const next = curr.map((t) => {
        if (t.kind !== "terminal" || !hasLeaf(t.paneTree, leafId)) return t;
        const paneTree = setLeafCwdInTree(t.paneTree, leafId, cwd);
        const isActive = t.activeLeafId === leafId;
        const cwdChanged = isActive && t.cwd !== cwd;
        if (paneTree === t.paneTree && !cwdChanged) return t;
        changed = true;
        return { ...t, paneTree, ...(cwdChanged && { cwd }) };
      });
      return changed ? next : curr;
    });
  }, []);

  const focusPane = useCallback((tabId: number, leafId: number) => {
    setTabs((curr) =>
      curr.map((t) => {
        if (t.id !== tabId || t.kind !== "terminal") return t;
        if (!hasLeaf(t.paneTree, leafId)) return t;
        if (t.activeLeafId === leafId) return t;
        const cwd = findLeafCwd(t.paneTree, leafId);
        return {
          ...t,
          activeLeafId: leafId,
          ...(cwd !== undefined && { cwd }),
        };
      }),
    );
  }, []);

  const focusNextPaneInTab = useCallback((tabId: number, delta: 1 | -1) => {
    setTabs((curr) =>
      curr.map((t) => {
        if (t.id !== tabId || t.kind !== "terminal") return t;
        const next = nextLeafId(t.paneTree, t.activeLeafId, delta);
        if (next === t.activeLeafId) return t;
        const cwd = findLeafCwd(t.paneTree, next);
        return { ...t, activeLeafId: next, ...(cwd !== undefined && { cwd }) };
      }),
    );
  }, []);

  /** Split the active leaf of `tabId` along `dir`. Returns the new leaf id. */
  const splitActivePane = useCallback(
    (tabId: number, dir: SplitDir): number | null => {
      let newLeafId: number | null = null;
      setTabs((curr) =>
        curr.map((t) => {
          if (t.id !== tabId || t.kind !== "terminal" || t.blocks) return t;
          if (leafIds(t.paneTree).length >= MAX_PANES_PER_TAB) return t;
          const splitId = nextIdRef.current++;
          const leafId = nextIdRef.current++;
          newLeafId = leafId;
          const paneTree = splitLeaf(
            t.paneTree,
            t.activeLeafId,
            splitId,
            leafId,
            dir,
            t.cwd,
          );
          return { ...t, paneTree, activeLeafId: leafId };
        }),
      );
      return newLeafId;
    },
    [],
  );

  const closePaneByLeaf = useCallback((leafId: number): void => {
    let didRemove = false;
    setTabs((curr) => {
      const tab = curr.find(
        (t) => t.kind === "terminal" && hasLeaf(t.paneTree, leafId),
      );
      if (tab?.kind !== "terminal") return curr;
      const newTree = removeLeaf(tab.paneTree, leafId);
      if (newTree === null) {
        const fallback = nextActiveInSpace(curr, tab.id);
        if (fallback === null) return curr;
        const next = curr.filter((x) => x.id !== tab.id);
        setActiveId((active) => (active === tab.id ? fallback : active));
        didRemove = true;
        return next;
      }
      const remaining = leafIds(newTree);
      let newActive = tab.activeLeafId;
      if (tab.activeLeafId === leafId) {
        const sib = siblingLeafOf(tab.paneTree, leafId);
        newActive = sib && remaining.includes(sib) ? sib : remaining[0];
      }
      didRemove = true;
      return curr.map((x) =>
        x.id === tab.id
          ? { ...x, paneTree: newTree, activeLeafId: newActive }
          : x,
      );
    });
    if (didRemove) disposeSession(leafId);
  }, []);

  const closeActivePane = useCallback((tabId: number): boolean => {
    let closedTab = false;
    let removedLeaf: number | null = null;
    setTabs((curr) => {
      const t = curr.find((x) => x.id === tabId);
      if (t?.kind !== "terminal") return curr;
      const target = t.activeLeafId;
      const newTree = removeLeaf(t.paneTree, target);
      if (newTree === null) {
        const fallback = nextActiveInSpace(curr, tabId);
        if (fallback === null) return curr;
        const next = curr.filter((x) => x.id !== tabId);
        setActiveId((active) => (active === tabId ? fallback : active));
        closedTab = true;
        removedLeaf = target;
        return next;
      }
      const remaining = leafIds(newTree);
      const sib = siblingLeafOf(t.paneTree, target);
      const newActive = sib && remaining.includes(sib) ? sib : remaining[0];
      removedLeaf = target;
      return curr.map((x) =>
        x.id === tabId
          ? { ...x, paneTree: newTree, activeLeafId: newActive }
          : x,
      );
    });
    if (removedLeaf !== null) disposeSession(removedLeaf);
    return closedTab;
  }, []);

  const resetWorkspace = useCallback((cwd?: string) => {
    const tabId = nextIdRef.current++;
    const leafId = nextIdRef.current++;
    let toDispose: number[] = [];
    setTabs((curr) => {
      toDispose = curr.flatMap((t) =>
        t.kind === "terminal" ? leafIds(t.paneTree) : [],
      );
      return [
        {
          id: tabId,
          kind: "terminal",
          title: "shell",
          cwd,
          paneTree: { kind: "leaf", id: leafId, cwd },
          activeLeafId: leafId,
        },
      ];
    });
    setActiveId(tabId);
    for (const lid of toDispose) disposeSession(lid);
  }, []);

  const reorderTabByGap = useCallback((fromId: number, toGapIndex: number) => {
    setTabs((prev) => reorderTabsByGap(prev, fromId, toGapIndex));
  }, []);

  return {
    tabs,
    activeId,
    setActiveId,
    allocId,
    replaceTabs,
    reorderTab,
    reorderTabByGap,
    markBooted,
    setOverrideLanguage,
    newTab,
    newBlockTab,
    openFileTab,
    pinTab,
    newMarkdownTab,
    newSftpTab,
    setMarkdownView,
    openGitDiffTab,
    openCommitHistoryTab,
    openCommitFileDiffTab,
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
  };
}

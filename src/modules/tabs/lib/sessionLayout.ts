import { TERMINAL_DEFAULT_TITLE } from "./tabLabel";
import type { Tab } from "./useTabs";

/**
 * Layout-only session persistence: the tab/pane tree, cwd and shell per leaf,
 * plus custom titles. Never buffer contents — panes reopen as fresh PTYs.
 *
 * Persisted under its own settings-store key, not as a `Preferences` field:
 * cross-window change events for it are meaningless.
 */

type SessionPane = {
  kind: "leaf";
  cwd?: string;
  shell?: string;
} | {
  kind: "split";
  dir: "row" | "col";
  children: SessionPane[];
};

type SessionTab = {
  customTitle?: string;
  cwd?: string;
  shell?: string;
  paneTree: SessionPane;
  /** Index (not id) of the leaf that was active inside this tab. */
  activeLeafIndex: number;
};

export type SessionLayout = {
  version: 1;
  tabs: SessionTab[];
  /** Index into `tabs`. */
  activeTabIndex: number;
};

const SESSION_LAYOUT_MAX_TABS = 20;
const SESSION_LAYOUT_MAX_LEAVES = 20;

type RawLeaf = {
  kind?: unknown;
  cwd?: unknown;
  shell?: unknown;
  id?: unknown;
  dir?: unknown;
  children?: unknown;
};

function parsePane(raw: RawLeaf): SessionPane | null {
  if (raw.kind === "leaf") {
    return {
      kind: "leaf",
      ...(typeof raw.cwd === "string" && raw.cwd && { cwd: raw.cwd }),
      ...(typeof raw.shell === "string" && raw.shell && { shell: raw.shell }),
    };
  }
  if (
    raw.kind === "split" &&
    (raw.dir === "row" || raw.dir === "col") &&
    Array.isArray(raw.children)
  ) {
    const children = raw.children
      .map((c) => (c && typeof c === "object" ? parsePane(c as RawLeaf) : null))
      .filter((p): p is SessionPane => p !== null);
    if (children.length < 2) return null;
    return { kind: "split", dir: raw.dir, children };
  }
  return null;
}

function countLeaves(pane: SessionPane): number {
  if (pane.kind === "leaf") return 1;
  return pane.children.reduce((n, c) => n + countLeaves(c), 0);
}

/**
 * Validate untrusted stored JSON into a layout, or null when it is unusable.
 * Shell ids are not checked against the backend list here: `pty_open`'s
 * sanitizer already falls back to the default for anything stale.
 */
export function parseSessionLayout(raw: unknown): SessionLayout | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as { version?: unknown; tabs?: unknown; activeTabIndex?: unknown };
  if (obj.version !== 1 || !Array.isArray(obj.tabs)) return null;
  const tabs: SessionTab[] = [];
  for (const entry of obj.tabs.slice(0, SESSION_LAYOUT_MAX_TABS)) {
    if (!entry || typeof entry !== "object") continue;
    const t = entry as RawLeaf & {
      customTitle?: unknown;
      activeLeafIndex?: unknown;
      paneTree?: unknown;
    };
    const paneTree =
      t.paneTree && typeof t.paneTree === "object"
        ? parsePane(t.paneTree as RawLeaf)
        : null;
    if (!paneTree) continue;
    if (countLeaves(paneTree) > SESSION_LAYOUT_MAX_LEAVES) continue;
    const leafCount = countLeaves(paneTree);
    const activeLeafIndex =
      typeof t.activeLeafIndex === "number" &&
      Number.isInteger(t.activeLeafIndex) &&
      t.activeLeafIndex >= 0 &&
      t.activeLeafIndex < leafCount
        ? t.activeLeafIndex
        : 0;
    tabs.push({
      paneTree,
      activeLeafIndex,
      ...(typeof t.customTitle === "string" &&
        t.customTitle && { customTitle: t.customTitle }),
      ...(typeof t.cwd === "string" && t.cwd && { cwd: t.cwd }),
      ...(typeof t.shell === "string" && t.shell && { shell: t.shell }),
    });
  }
  if (tabs.length === 0) return null;
  const activeTabIndex =
    typeof obj.activeTabIndex === "number" &&
    obj.activeTabIndex >= 0 &&
    obj.activeTabIndex < tabs.length
      ? obj.activeTabIndex
      : 0;
  return { version: 1, tabs, activeTabIndex };
}

export function serializeSessionLayout(
  tabs: Tab[],
  activeId: number,
): SessionLayout | null {
  const out: SessionTab[] = [];
  let activeTabIndex = 0;
  for (const tab of tabs) {
    if (tab.kind !== "terminal") continue;
    if (tab.id === activeId) activeTabIndex = out.length;
    if (out.length >= SESSION_LAYOUT_MAX_TABS) break;
    const leaves = leafPaths(tab.paneTree);
    let activeLeafIndex = 0;
    const paneTree = toSessionPane(tab.paneTree);
    // Pick the active leaf's index from the same traversal order.
    let leafIdx = 0;
    let found = false;
    for (const path of leaves) {
      if (path === tab.activeLeafId) {
        activeLeafIndex = leafIdx;
        found = true;
        break;
      }
      leafIdx++;
    }
    if (!found) activeLeafIndex = 0;
    out.push({
      paneTree,
      activeLeafIndex,
      ...(tab.customTitle && { customTitle: tab.customTitle }),
      ...(tab.cwd && { cwd: tab.cwd }),
      ...(tab.shell && { shell: tab.shell }),
    });
  }
  if (out.length === 0) return null;
  return { version: 1, tabs: out, activeTabIndex };
}

function leafPaths(node: Tab["paneTree"]): number[] {
  if (node.kind === "leaf") return [node.id];
  return node.children.flatMap(leafPaths);
}

function toSessionPane(node: Tab["paneTree"]): SessionPane {
  if (node.kind === "leaf") {
    return {
      kind: "leaf",
      ...(node.cwd && { cwd: node.cwd }),
      ...(node.shell && { shell: node.shell }),
    };
  }
  return {
    kind: "split",
    dir: node.dir,
    children: node.children.map(toSessionPane),
  };
}

type IdAllocator = () => number;

type BuiltPane = { node: Tab["paneTree"]; leaves: { id: number; cwd?: string }[] };

function buildPane(
  pane: SessionPane,
  allocId: IdAllocator,
): BuiltPane {
  if (pane.kind === "leaf") {
    const id = allocId();
    return {
      node: {
        kind: "leaf",
        id,
        ...(pane.cwd && { cwd: pane.cwd }),
        ...(pane.shell && { shell: pane.shell }),
      },
      leaves: [{ id, ...(pane.cwd && { cwd: pane.cwd }) }],
    };
  }
  const children = pane.children.map((c) => buildPane(c, allocId));
  return {
    node: {
      kind: "split",
      id: allocId(),
      dir: pane.dir,
      children: children.map((c) => c.node),
    },
    leaves: children.flatMap((c) => c.leaves),
  };
}

/**
 * Rebuild live `Tab` objects from a validated layout. Ids come fresh from the
 * tab module's allocator; every tab starts cold so shells only spawn when the
 * tab (or its panes) is actually shown.
 */
export function buildTabsFromLayout(
  layout: SessionLayout,
  allocId: IdAllocator,
): { tabs: Tab[]; activeId: number } {
  const tabs: Tab[] = layout.tabs.map((st) => {
    const built = buildPane(st.paneTree, allocId);
    const activeLeaf =
      built.leaves[Math.min(st.activeLeafIndex, built.leaves.length - 1)];
    const tabCwd = st.cwd ?? activeLeaf.cwd;
    return {
      id: allocId(),
      kind: "terminal" as const,
      cold: true,
      title: TERMINAL_DEFAULT_TITLE,
      ...(st.customTitle && { customTitle: st.customTitle }),
      ...(st.shell && { shell: st.shell }),
      // The tab label derives from `cwd`; the saved one is the active leaf's
      // cwd at snapshot time, and the leaf fallback covers older snapshots.
      ...(tabCwd && { cwd: tabCwd }),
      paneTree: built.node,
      activeLeafId: activeLeaf.id,
    };
  });
  const activeId = tabs[layout.activeTabIndex]?.id ?? tabs[0].id;
  return { tabs, activeId };
}

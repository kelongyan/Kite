import { native } from "@/modules/ai/lib/native";
import type { Tab } from "@/modules/tabs";
import { DEFAULT_SPACE_ID } from "@/modules/tabs/lib/useTabs";
import { isLeaf, type PaneNode } from "@/modules/terminal/lib/panes";
import { useEffect, useRef } from "react";
import { freshTerminalTab } from "./freshTerminalTab";
import type { SpaceMeta } from "./store";
import { useSpaces } from "./useSpaces";

type Params = {
  ready: boolean;
  launchCwd: string | null;
  home: string | null;
  allocId: () => number;
  replaceTabs: (tabs: Tab[], activeId: number) => void;
  markBooted: () => void;
  setActiveSpaceForNewTabs: (id: string) => void;
};

function uniqueCwds(tabs: Tab[]): string[] {
  const set = new Set<string>();
  const walk = (n: PaneNode) => {
    if (isLeaf(n)) {
      if (n.cwd) set.add(n.cwd);
      return;
    }
    for (const c of n.children) walk(c);
  };
  for (const t of tabs) if (t.kind === "terminal") walk(t.paneTree);
  return [...set];
}

export function useSpacesBoot({
  ready,
  launchCwd,
  home,
  allocId,
  replaceTabs,
  markBooted,
  setActiveSpaceForNewTabs,
}: Params) {
  const done = useRef(false);

  useEffect(() => {
    if (!ready || done.current) return;
    done.current = true;

    void (async () => {
      try {
        const root = launchCwd ?? home ?? null;
        const now = Date.now();
        const meta: SpaceMeta = {
          id: DEFAULT_SPACE_ID,
          name: "Default",
          root,
          env: { kind: "local" },
          createdAt: now,
          updatedAt: now,
        };
        const tab = freshTerminalTab(DEFAULT_SPACE_ID, root, allocId);
        await Promise.allSettled(
          uniqueCwds([tab]).map((cwd) => native.workspaceAuthorize(cwd)),
        );
        setActiveSpaceForNewTabs(DEFAULT_SPACE_ID);
        useSpaces.getState().hydrate([meta], DEFAULT_SPACE_ID);
        replaceTabs([tab], tab.id);
      } catch (e) {
        console.error("[kite] spaces boot failed:", e);
      } finally {
        markBooted();
      }
    })();
  }, [
    ready,
    launchCwd,
    home,
    allocId,
    replaceTabs,
    markBooted,
    setActiveSpaceForNewTabs,
  ]);
}

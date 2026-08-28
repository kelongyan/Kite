import { useCallback, useState } from "react";
import { leafHasForegroundProcess, leafIds } from "@/modules/terminal";
import { nextActiveTab, type Tab } from "@/modules/tabs";

type Params = {
  tabs: Tab[];
  disposeTab: (id: number) => void;
};

/**
 * Guards tab closing: terminals with a live foreground process route through a
 * confirmation dialog instead of closing immediately. Owns the pending-close
 * state the dialog renders from.
 */
export function useTabCloseGuards({ tabs, disposeTab }: Params) {
  const [pendingTerminalCloseTab, setPendingTerminalCloseTab] = useState<
    number | null
  >(null);

  const handleClose = useCallback(
    async (id: number) => {
      // The last tab can't be closed (closeTab refuses). Skip the
      // dialog entirely so confirming it doesn't appear to silently fail.
      if (nextActiveTab(tabs, id) === null) return;
      const t = tabs.find((x) => x.id === id);
      if (t?.kind === "terminal") {
        const leaves = leafIds(t.paneTree);
        const checks = await Promise.all(leaves.map(leafHasForegroundProcess));
        if (checks.some(Boolean)) {
          setPendingTerminalCloseTab(id);
          return;
        }
      }
      disposeTab(id);
    },
    [tabs, disposeTab],
  );

  const confirmTerminalClose = useCallback(() => {
    if (pendingTerminalCloseTab !== null) disposeTab(pendingTerminalCloseTab);
    setPendingTerminalCloseTab(null);
  }, [pendingTerminalCloseTab, disposeTab]);

  const cancelTerminalClose = useCallback(() => {
    setPendingTerminalCloseTab(null);
  }, []);

  return {
    pendingTerminalCloseTab,
    handleClose,
    confirmTerminalClose,
    cancelTerminalClose,
  };
}

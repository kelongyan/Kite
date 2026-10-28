import { create } from "zustand";

/**
 * Tabs that produced output while not being the active tab. The dot clears
 * when the user switches to the tab — seeing it counts as acknowledging it.
 */
type TabActivityState = {
  activeTabs: ReadonlySet<number>;
  /**
   * Leaves inside their OSC 133 C..D window. Keyed by leaf, not by tab, so a
   * pane closed mid-command cannot leave its tab pulsing forever: the tab
   * looks up its own leaves and drops the state with them.
   */
  runningLeaves: ReadonlySet<number>;
  markActive: (tabId: number) => void;
  clear: (tabId: number) => void;
  setLeafRunning: (leafId: number, running: boolean) => void;
};

export const useTabActivityStore = create<TabActivityState>((set) => ({
  activeTabs: new Set<number>(),
  runningLeaves: new Set<number>(),
  markActive: (tabId) =>
    set((s) => {
      if (s.activeTabs.has(tabId)) return s;
      const next = new Set(s.activeTabs);
      next.add(tabId);
      return { activeTabs: next };
    }),
  clear: (tabId) =>
    set((s) => {
      if (!s.activeTabs.has(tabId)) return s;
      const next = new Set(s.activeTabs);
      next.delete(tabId);
      return { activeTabs: next };
    }),
  setLeafRunning: (leafId, running) =>
    set((s) => {
      if (s.runningLeaves.has(leafId) === running) return s;
      const next = new Set(s.runningLeaves);
      if (running) next.add(leafId);
      else next.delete(leafId);
      return { runningLeaves: next };
    }),
}));

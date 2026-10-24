import { create } from "zustand";

/**
 * Tabs that produced output while not being the active tab. The dot clears
 * when the user switches to the tab — seeing it counts as acknowledging it.
 */
type TabActivityState = {
  activeTabs: ReadonlySet<number>;
  markActive: (tabId: number) => void;
  clear: (tabId: number) => void;
};

export const useTabActivityStore = create<TabActivityState>((set) => ({
  activeTabs: new Set<number>(),
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
}));

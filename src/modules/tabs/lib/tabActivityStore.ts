import { create } from "zustand";

/**
 * Per-leaf command state, mirroring the background-tab indicators:
 * - "working": the leaf is inside its OSC 133 C..D window (breathing dot,
 *   sweeping tab label, and the label shows the reported command line).
 * - "done" / "failed": the command finished while its tab was in the
 *   background, so the user has not seen the result yet (green / red dot).
 *   Cleared when the tab is activated — seeing it counts as acknowledging it.
 * - "bell": transient pulse after a terminal bell.
 */
export type LeafCommandState = {
  state: "working" | "done" | "failed" | "bell";
  /** Command line of the running command; present only while working. */
  cmdline?: string;
};

type TabActivityState = {
  activeTabs: ReadonlySet<number>;
  leafStates: ReadonlyMap<number, LeafCommandState>;
  markActive: (tabId: number) => void;
  clear: (tabId: number) => void;
  setLeafWorking: (leafId: number, cmdline?: string) => void;
  setLeafFinished: (leafId: number, failed: boolean) => void;
  setLeafBell: (leafId: number) => void;
  clearLeafState: (leafId: number) => void;
};

const BELL_PULSE_MS = 900;

export const useTabActivityStore = create<TabActivityState>((set, get) => ({
  activeTabs: new Set<number>(),
  leafStates: new Map<number, LeafCommandState>(),
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
  setLeafWorking: (leafId, cmdline) =>
    set((s) => {
      const prev = s.leafStates.get(leafId);
      if (prev?.state === "working" && prev.cmdline === cmdline) return s;
      const next = new Map(s.leafStates);
      next.set(leafId, { state: "working", ...(cmdline && { cmdline }) });
      return { leafStates: next };
    }),
  setLeafFinished: (leafId, failed) =>
    set((s) => {
      const prev = s.leafStates.get(leafId);
      const state = failed ? "failed" : "done";
      if (prev?.state === state) return s;
      const next = new Map(s.leafStates);
      next.set(leafId, { state });
      return { leafStates: next };
    }),
  setLeafBell: (leafId) => {
    set((s) => {
      const prev = s.leafStates.get(leafId);
      if (prev?.state === "bell") return s;
      const next = new Map(s.leafStates);
      next.set(leafId, { state: "bell" });
      return { leafStates: next };
    });
    // One pulse, then gone unless a newer state took over.
    setTimeout(() => {
      const current = get().leafStates.get(leafId);
      if (current?.state === "bell") get().clearLeafState(leafId);
    }, BELL_PULSE_MS);
  },
  clearLeafState: (leafId) =>
    set((s) => {
      if (!s.leafStates.has(leafId)) return s;
      const next = new Map(s.leafStates);
      next.delete(leafId);
      return { leafStates: next };
    }),
}));

import { create } from "zustand";

/**
 * Terminal in-buffer search UI state. Global (one search bar at a time); the
 * bar renders inside the focused pane and drives the per-leaf xterm search
 * addon from there. The query persists across pane switches, matches do not.
 */
type TerminalSearchState = {
  open: boolean;
  query: string;
  caseSensitive: boolean;
  /** -1 index means the highlight limit was exceeded; 0 count means no match. */
  resultIndex: number;
  resultCount: number;
  openSearch: () => void;
  closeSearch: () => void;
  setQuery: (query: string) => void;
  setCaseSensitive: (caseSensitive: boolean) => void;
  setResults: (resultIndex: number, resultCount: number) => void;
};

export const useTerminalSearchStore = create<TerminalSearchState>((set) => ({
  open: false,
  query: "",
  caseSensitive: false,
  resultIndex: 0,
  resultCount: 0,
  openSearch: () => set({ open: true }),
  closeSearch: () =>
    set({ open: false, resultIndex: 0, resultCount: 0 }),
  setQuery: (query) => set({ query }),
  setCaseSensitive: (caseSensitive) => set({ caseSensitive }),
  setResults: (resultIndex, resultCount) =>
    set({ resultIndex, resultCount }),
}));

import { create } from "zustand";
import type { PasteConfirmReason } from "./clipboardPolicy";

type PendingTerminalPaste = {
  leafId: number;
  text: string;
  reason: PasteConfirmReason;
  lines: number;
  chars: number;
  preview: string;
};

/**
 * Staging state for a paste that needs confirmation (multiline or oversized).
 * The renderer pool requests; the dialog confirms and performs the paste via
 * the renderer pool's own paste path.
 */
type PasteGuardState = {
  pending: PendingTerminalPaste | null;
  request: (pending: PendingTerminalPaste) => void;
  clear: () => void;
};

export const usePasteGuardStore = create<PasteGuardState>((set) => ({
  pending: null,
  request: (pending) => set({ pending }),
  clear: () => set({ pending: null }),
}));

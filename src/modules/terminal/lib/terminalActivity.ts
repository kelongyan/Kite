/**
 * Leaf-level activity events (bell, command completion, output) fanned out to
 * app-level listeners. The renderer pool and terminal sessions know leaf ids;
 * only the app layer can map a leaf to its tab and decide what deserves a
 * notification or a tab activity badge.
 */
export type TerminalActivity = {
  leafId: number;
  kind: "bell" | "commandFinished" | "output";
  /** Optional human text for bell-driven notifications (OSC 9 / 777). */
  message?: string;
};

type TerminalActivityListener = (activity: TerminalActivity) => void;

const listeners = new Set<TerminalActivityListener>();

export function emitTerminalActivity(activity: TerminalActivity): void {
  for (const listener of listeners) listener(activity);
}

export function onTerminalActivity(
  listener: TerminalActivityListener,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

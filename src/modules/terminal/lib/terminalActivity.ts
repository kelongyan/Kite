/**
 * Leaf-level activity events (bell, command completion, output) fanned out to
 * app-level listeners. The renderer pool and terminal sessions know leaf ids;
 * only the app layer can map a leaf to its tab and decide what deserves a
 * notification or a tab activity badge.
 */
export type TerminalActivity = {
  leafId: number;
  kind: "bell" | "commandFinished" | "commandState" | "output";
  /** Optional human text for bell-driven notifications (OSC 9 / 777). */
  message?: string;
  /**
   * Only for `commandState`: true while the leaf is inside its OSC 133 C..D
   * window. Drives the animated activity dot on background tabs.
   */
  running?: boolean;
  /** Only for `commandState` start: the reported command line, when known. */
  cmdline?: string;
  /** Only for `commandState` end: the reported exit status, when known. */
  exitCode?: number | null;
  /** Only for `commandFinished`: wall-clock time the command took. */
  durationMs?: number;
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

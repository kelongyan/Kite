export type SelectMode = "replace" | "toggle" | "range";

export type SelectableEntry = {
  name: string;
  path: string;
};

export function nextSelection(
  current: Set<string>,
  path: string,
  mode: SelectMode,
  visiblePaths: string[] = [],
  anchorPath?: string | null,
): Set<string> {
  if (mode === "replace") return new Set([path]);

  if (mode === "toggle") {
    const next = new Set(current);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    return next;
  }

  const anchor = anchorPath && visiblePaths.includes(anchorPath) ? anchorPath : path;
  const start = visiblePaths.indexOf(anchor);
  const end = visiblePaths.indexOf(path);
  if (start === -1 || end === -1) return new Set([path]);

  const [from, to] = start <= end ? [start, end] : [end, start];
  return new Set(visiblePaths.slice(from, to + 1));
}

export function selectedEntries<T extends SelectableEntry>(
  entries: T[],
  selectedPaths: Set<string>,
): T[] {
  return entries.filter((entry) => selectedPaths.has(entry.path));
}

export function detectNameConflicts<T extends SelectableEntry>(
  entries: T[],
  destinationNames: Set<string>,
): T[] {
  const normalized = new Set(
    [...destinationNames].map((name) => name.toLowerCase()),
  );
  return entries.filter((entry) => normalized.has(entry.name.toLowerCase()));
}

import type { LocalEntry, SftpEntry } from "./types";

export type SyncDirection = "localToRemote" | "remoteToLocal";
export type SyncOperation =
  | "create"
  | "overwrite"
  | "same"
  | "keepDestination"
  | "conflict";
export type SyncConflictReason = "kindMismatch";

export type SyncChange = {
  name: string;
  operation: SyncOperation;
  direction: SyncDirection;
  sourcePath: string | null;
  destinationPath: string | null;
  sourceKind: LocalEntry["kind"] | SftpEntry["kind"] | null;
  destinationKind: LocalEntry["kind"] | SftpEntry["kind"] | null;
  reason?: SyncConflictReason;
};

export type SyncPlan = {
  direction: SyncDirection;
  changes: SyncChange[];
  applyPaths: string[];
  hasDeletes: boolean;
  hasOverwrites: boolean;
  hasConflicts: boolean;
};

export function buildSyncPlan({
  direction,
  localEntries,
  remoteEntries,
}: {
  direction: SyncDirection;
  localEntries: LocalEntry[];
  remoteEntries: SftpEntry[];
}): SyncPlan {
  const sourceEntries =
    direction === "localToRemote" ? localEntries : remoteEntries;
  const destinationEntries =
    direction === "localToRemote" ? remoteEntries : localEntries;
  const sourceByName = new Map(
    sourceEntries.map((entry) => [entry.name, entry]),
  );
  const destinationByName = new Map(
    destinationEntries.map((entry) => [entry.name, entry]),
  );
  const names = [
    ...new Set([...sourceByName.keys(), ...destinationByName.keys()]),
  ].sort((a, b) => a.localeCompare(b));

  const changes = names.map((name): SyncChange => {
    const source = sourceByName.get(name) ?? null;
    const destination = destinationByName.get(name) ?? null;
    if (!source && destination) {
      return {
        name,
        operation: "keepDestination",
        direction,
        sourcePath: null,
        destinationPath: destination.path,
        sourceKind: null,
        destinationKind: destination.kind,
      };
    }
    if (source && !destination) {
      return change("create", direction, source, null);
    }
    if (source && destination) {
      if (source.kind !== destination.kind) {
        return {
          ...change("conflict", direction, source, destination),
          reason: "kindMismatch",
        };
      }
      if (source.kind === "file" && destination.kind === "file") {
        return change(
          source.size === destination.size ? "same" : "overwrite",
          direction,
          source,
          destination,
        );
      }
      return change("same", direction, source, destination);
    }
    throw new Error("unreachable sync diff state");
  });

  const applyPaths = changes
    .filter(
      (change) =>
        change.operation === "create" || change.operation === "overwrite",
    )
    .map((change) => change.sourcePath)
    .filter((path): path is string => Boolean(path));

  return {
    direction,
    changes,
    applyPaths,
    hasDeletes: false,
    hasOverwrites: changes.some((change) => change.operation === "overwrite"),
    hasConflicts: changes.some((change) => change.operation === "conflict"),
  };
}

export function syncPlanNeedsOverwriteConfirmation(plan: SyncPlan): boolean {
  return plan.hasOverwrites;
}

function change(
  operation: SyncOperation,
  direction: SyncDirection,
  source: LocalEntry | SftpEntry,
  destination: LocalEntry | SftpEntry | null,
): SyncChange {
  return {
    name: source.name,
    operation,
    direction,
    sourcePath: source.path,
    destinationPath: destination?.path ?? null,
    sourceKind: source.kind,
    destinationKind: destination?.kind ?? null,
  };
}

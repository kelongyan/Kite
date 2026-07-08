import { describe, expect, it } from "vitest";
import {
  buildSyncPlan,
  syncPlanNeedsOverwriteConfirmation,
} from "./diffEntries";
import type { LocalEntry, SftpEntry } from "./types";

const local = (
  overrides: Partial<LocalEntry> & { name: string },
): LocalEntry => ({
  path: `C:/repo/${overrides.name}`,
  kind: "file",
  size: 10,
  mtime: 1000,
  ...overrides,
});

const remote = (
  overrides: Partial<SftpEntry> & { name: string },
): SftpEntry => ({
  path: `/srv/${overrides.name}`,
  kind: "file",
  size: 10,
  mtime: 1000,
  permissions: "-rw-r--r--",
  ...overrides,
});

describe("buildSyncPlan", () => {
  it("plans local-to-remote creates and overwrites without deleting destination-only files", () => {
    const plan = buildSyncPlan({
      direction: "localToRemote",
      localEntries: [
        local({ name: "same.txt", size: 10 }),
        local({ name: "changed.txt", size: 20 }),
        local({ name: "new.txt", size: 3 }),
      ],
      remoteEntries: [
        remote({ name: "same.txt", size: 10 }),
        remote({ name: "changed.txt", size: 5 }),
        remote({ name: "remote-only.txt", size: 1 }),
      ],
    });

    expect(
      plan.changes.map((change) => [change.name, change.operation]),
    ).toEqual([
      ["changed.txt", "overwrite"],
      ["new.txt", "create"],
      ["remote-only.txt", "keepDestination"],
      ["same.txt", "same"],
    ]);
    expect(plan.hasDeletes).toBe(false);
    expect(plan.hasOverwrites).toBe(true);
  });

  it("reports kind conflicts instead of overwriting across file and folder types", () => {
    const plan = buildSyncPlan({
      direction: "remoteToLocal",
      localEntries: [local({ name: "app", kind: "dir", size: 0 })],
      remoteEntries: [remote({ name: "app", kind: "file", size: 42 })],
    });

    expect(plan.changes).toHaveLength(1);
    expect(plan.changes[0]).toMatchObject({
      name: "app",
      operation: "conflict",
      reason: "kindMismatch",
    });
    expect(plan.applyPaths).toEqual([]);
  });

  it("uses remote source paths when planning remote-to-local sync", () => {
    const plan = buildSyncPlan({
      direction: "remoteToLocal",
      localEntries: [
        local({ name: "changed.txt", size: 1 }),
        local({ name: "local-only.txt", size: 1 }),
      ],
      remoteEntries: [
        remote({ name: "changed.txt", size: 9 }),
        remote({ name: "new.txt", size: 3 }),
      ],
    });

    expect(
      plan.changes.map((change) => [change.name, change.operation]),
    ).toEqual([
      ["changed.txt", "overwrite"],
      ["local-only.txt", "keepDestination"],
      ["new.txt", "create"],
    ]);
    expect(plan.applyPaths).toEqual(["/srv/changed.txt", "/srv/new.txt"]);
    expect(plan.hasDeletes).toBe(false);
  });

  it("requires explicit confirmation only when a plan overwrites files", () => {
    expect(
      syncPlanNeedsOverwriteConfirmation(
        buildSyncPlan({
          direction: "localToRemote",
          localEntries: [local({ name: "new.txt", size: 3 })],
          remoteEntries: [],
        }),
      ),
    ).toBe(false);
    expect(
      syncPlanNeedsOverwriteConfirmation(
        buildSyncPlan({
          direction: "localToRemote",
          localEntries: [local({ name: "changed.txt", size: 3 })],
          remoteEntries: [remote({ name: "changed.txt", size: 1 })],
        }),
      ),
    ).toBe(true);
  });
});

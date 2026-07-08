import { describe, expect, test } from "vitest";
import {
  detectNameConflicts,
  nextSelection,
  selectedEntries,
} from "./selection";

const entries = [
  { name: "a.txt", path: "/a.txt" },
  { name: "b.txt", path: "/b.txt" },
  { name: "c.txt", path: "/c.txt" },
];

describe("SFTP selection helpers", () => {
  test("toggles individual selections without dropping existing paths", () => {
    const selected = nextSelection(new Set(["/a.txt"]), "/b.txt", "toggle");
    expect([...selected].sort()).toEqual(["/a.txt", "/b.txt"]);
    expect([...nextSelection(selected, "/a.txt", "toggle")]).toEqual([
      "/b.txt",
    ]);
  });

  test("selects visible ranges from an anchor", () => {
    const selected = nextSelection(
      new Set(["/a.txt"]),
      "/c.txt",
      "range",
      entries.map((entry) => entry.path),
      "/a.txt",
    );
    expect([...selected]).toEqual(["/a.txt", "/b.txt", "/c.txt"]);
  });

  test("detects destination name conflicts case-insensitively", () => {
    const conflicts = detectNameConflicts(entries, new Set(["B.TXT"]));
    expect(conflicts.map((entry) => entry.path)).toEqual(["/b.txt"]);
    expect(selectedEntries(entries, new Set(["/a.txt"]))).toEqual([entries[0]]);
  });
});

import { describe, expect, it } from "vitest";
import { nextActiveInSpace, type Tab } from "./useTabs";

function term(id: number): Tab {
  return {
    id,
    kind: "terminal",
    title: "shell",
    paneTree: { kind: "leaf", id: id * 10 },
    activeLeafId: id * 10,
  } as Tab;
}

describe("nextActiveInSpace", () => {
  it("picks the previous tab", () => {
    const tabs = [term(1), term(2), term(3)];
    expect(nextActiveInSpace(tabs, 3)).toBe(2);
    expect(nextActiveInSpace(tabs, 2)).toBe(1);
  });

  it("falls forward when closing the first tab", () => {
    const tabs = [term(1), term(2)];
    expect(nextActiveInSpace(tabs, 1)).toBe(2);
  });

  it("returns null for the last tab", () => {
    const tabs = [term(1)];
    expect(nextActiveInSpace(tabs, 1)).toBeNull();
  });

  it("returns null for an unknown id", () => {
    expect(nextActiveInSpace([term(1)], 99)).toBeNull();
  });
});

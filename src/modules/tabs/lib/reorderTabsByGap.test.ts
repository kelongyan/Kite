import { describe, expect, it } from "vitest";
import { reorderTabsByGap, type Tab } from "./useTabs";

function term(id: number): Tab {
  return {
    id,
    kind: "terminal",
    title: "shell",
    paneTree: { kind: "leaf", id: id * 10 },
    activeLeafId: id * 10,
  } as Tab;
}

const ids = (tabs: Tab[]) => tabs.map((t) => t.id);

describe("reorderTabsByGap", () => {
  it("moves a tab right into a middle gap without overshooting", () => {
    const tabs = [term(1), term(2), term(3)];
    expect(ids(reorderTabsByGap(tabs, 1, 2))).toEqual([2, 1, 3]);
  });

  it("moves a tab left", () => {
    const tabs = [term(1), term(2), term(3)];
    expect(ids(reorderTabsByGap(tabs, 3, 1))).toEqual([1, 3, 2]);
  });

  it("moves a tab to the end", () => {
    const tabs = [term(1), term(2), term(3)];
    expect(ids(reorderTabsByGap(tabs, 1, 3))).toEqual([2, 3, 1]);
  });

  it("is a no-op for the gaps adjacent to the source", () => {
    const tabs = [term(1), term(2), term(3)];
    expect(ids(reorderTabsByGap(tabs, 1, 0))).toEqual([1, 2, 3]);
    expect(ids(reorderTabsByGap(tabs, 1, 1))).toEqual([1, 2, 3]);
  });

  it("returns the input unchanged for an unknown id", () => {
    const tabs = [term(1), term(2)];
    expect(reorderTabsByGap(tabs, 99, 1)).toBe(tabs);
  });
});

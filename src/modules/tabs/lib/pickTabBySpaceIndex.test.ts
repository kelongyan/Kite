import { describe, expect, it } from "vitest";
import { pickTabBySpaceIndex, type Tab } from "./useTabs";

function term(id: number): Tab {
  return {
    id,
    kind: "terminal",
    title: "shell",
    paneTree: { kind: "leaf", id: id * 10 },
    activeLeafId: id * 10,
  } as Tab;
}

describe("pickTabBySpaceIndex", () => {
  const tabs = [term(1), term(2), term(3)];

  it("returns tab by index", () => {
    expect(pickTabBySpaceIndex(tabs, 0)?.id).toBe(1);
    expect(pickTabBySpaceIndex(tabs, 1)?.id).toBe(2);
    expect(pickTabBySpaceIndex(tabs, 2)?.id).toBe(3);
  });

  it("returns undefined out of bounds", () => {
    expect(pickTabBySpaceIndex(tabs, 5)).toBeUndefined();
  });
});

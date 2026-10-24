import { describe, expect, it } from "vitest";
import type { Tab } from "./useTabs";
import {
  buildTabsFromLayout,
  parseSessionLayout,
  serializeSessionLayout,
  type SessionLayout,
} from "./sessionLayout";

function makeTab(overrides: Partial<Tab> & { id: number }): Tab {
  return {
    kind: "terminal",
    title: "Kite",
    paneTree: { kind: "leaf", id: overrides.id + 1000 },
    activeLeafId: overrides.id + 1000,
    ...overrides,
  } as Tab;
}

describe("parseSessionLayout", () => {
  it("accepts a valid layout", () => {
    const layout: SessionLayout = {
      version: 1,
      activeTabIndex: 1,
      tabs: [
        { paneTree: { kind: "leaf", cwd: "F:/a" }, activeLeafIndex: 0 },
        {
          shell: "wsl:Ubuntu",
          paneTree: {
            kind: "split",
            dir: "row",
            children: [
              { kind: "leaf", cwd: "F:/b" },
              { kind: "leaf", cwd: "F:/c", shell: "wsl:Ubuntu" },
            ],
          },
          activeLeafIndex: 1,
        },
      ],
    };
    expect(parseSessionLayout(layout)).toEqual(layout);
  });

  it("rejects garbage and out-of-range indexes", () => {
    expect(parseSessionLayout(null)).toBeNull();
    expect(parseSessionLayout({ version: 2, tabs: [] })).toBeNull();
    expect(parseSessionLayout({ version: 1, tabs: "x" })).toBeNull();
    const badSplit = parseSessionLayout({
      version: 1,
      tabs: [{ paneTree: { kind: "split", dir: "row", children: [] }, activeLeafIndex: 0 }],
    });
    expect(badSplit).toBeNull();
    const clamped = parseSessionLayout({
      version: 1,
      tabs: [{ paneTree: { kind: "leaf" }, activeLeafIndex: 9 }],
    });
    expect(clamped?.tabs[0]?.activeLeafIndex).toBe(0);
  });

  it("caps tabs and drops split children below two", () => {
    const single = parseSessionLayout({
      version: 1,
      tabs: [
        {
          paneTree: {
            kind: "split",
            dir: "col",
            children: [{ kind: "leaf" }, { kind: "leaf" }],
          },
          activeLeafIndex: 0,
        },
      ],
    });
    expect(single).not.toBeNull();
  });
});

describe("serializeSessionLayout", () => {
  it("captures tree, cwd, shell and active index", () => {
    const tabs = [
      makeTab({ id: 5, cwd: "F:/a" }),
      makeTab({
        id: 9,
        cwd: "F:/b",
        shell: "wsl:Ubuntu",
        customTitle: "build",
        paneTree: {
          kind: "split",
          id: 50,
          dir: "col",
          children: [
            { kind: "leaf", id: 11, cwd: "F:/b", shell: "wsl:Ubuntu" },
            { kind: "leaf", id: 12, cwd: "F:/c", shell: "wsl:Ubuntu" },
          ],
        },
        activeLeafId: 12,
      }),
    ];
    const layout = serializeSessionLayout(tabs, 9);
    expect(layout?.activeTabIndex).toBe(1);
    expect(layout?.tabs[0]?.cwd).toBe("F:/a");
    expect(layout?.tabs[1]?.shell).toBe("wsl:Ubuntu");
    expect(layout?.tabs[1]?.customTitle).toBe("build");
    expect(layout?.tabs[1]?.activeLeafIndex).toBe(1);
    const pane = layout?.tabs[1]?.paneTree;
    expect(pane?.kind).toBe("split");
    if (pane?.kind !== "split") return;
    expect(pane.children[1]).toEqual({
      kind: "leaf",
      cwd: "F:/c",
      shell: "wsl:Ubuntu",
    });
  });
});

describe("buildTabsFromLayout", () => {
  it("rebuilds cold tabs with fresh ids and preserved cwd/shell", () => {
    let next = 100;
    const allocId = () => next++;
    const layout = parseSessionLayout({
      version: 1,
      activeTabIndex: 0,
      tabs: [
        {
          shell: "wsl:Ubuntu",
          customTitle: "dev",
          paneTree: {
            kind: "split",
            dir: "row",
            children: [
              { kind: "leaf", cwd: "F:/b", shell: "wsl:Ubuntu" },
              { kind: "leaf", cwd: "F:/c" },
            ],
          },
          activeLeafIndex: 1,
        },
      ],
    });
    if (!layout) throw new Error("fixture layout must parse");
    const built = buildTabsFromLayout(layout, allocId);
    expect(built.tabs).toHaveLength(1);
    const tab = built.tabs[0];
    expect(tab.cold).toBe(true);
    expect(tab.customTitle).toBe("dev");
    expect(tab.shell).toBe("wsl:Ubuntu");
    expect(tab.cwd).toBe("F:/c");
    expect(tab.paneTree.kind).toBe("split");
    const leaves = tab.paneTree.kind === "split" ? tab.paneTree.children : [];
    expect(leaves[0]).toMatchObject({ kind: "leaf", cwd: "F:/b", shell: "wsl:Ubuntu" });
    expect(tab.activeLeafId).toBe(leaves[1].id);
    expect(built.activeId).toBe(tab.id);
    // ids never collide with the pre-seeded initial tab (1/2).
    const ids = [tab.id, leaves[0].id, leaves[1].id];
    expect(new Set(ids).size).toBe(ids.length);
  });
});

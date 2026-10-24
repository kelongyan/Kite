import { describe, expect, it } from "vitest";
import {
  findLeafCwd,
  findLeafShell,
  hasLeaf,
  leafIds,
  nextLeafId,
  removeLeaf,
  setLeafCwd,
  siblingLeafOf,
  splitLeaf,
  type PaneNode,
} from "./panes";

// row(1, row(2, 3), 4)
const nested: PaneNode = {
  kind: "split",
  id: 90,
  dir: "row",
  children: [
    { kind: "leaf", id: 1 },
    {
      kind: "split",
      id: 91,
      dir: "row",
      children: [
        { kind: "leaf", id: 2 },
        { kind: "leaf", id: 3 },
      ],
    },
    { kind: "leaf", id: 4 },
  ],
};

describe("leafIds", () => {
  it("walks leaves in order", () => {
    expect(leafIds(nested)).toEqual([1, 2, 3, 4]);
    expect(leafIds({ kind: "leaf", id: 7 })).toEqual([7]);
  });
});

describe("splitLeaf", () => {
  it("appends a sibling when the enclosing split already runs in dir", () => {
    const t = splitLeaf(nested, 2, 99, 5, "row");
    const inner = (t as typeof nested).children[1] as Extract<
      PaneNode,
      { kind: "split" }
    >;
    // Same-direction splits stay flat: the new leaf joins the inner row.
    expect(inner.dir).toBe("row");
    expect(leafIds(inner)).toEqual([2, 5, 3]);
  });

  it("inserts directly into a top-level row when the target is its child", () => {
    const t = splitLeaf(nested, 1, 99, 5, "row");
    expect(leafIds(t)).toEqual([1, 5, 2, 3, 4]);
  });

  it("nests a fresh split when the direction differs", () => {
    const t = splitLeaf(nested, 1, 99, 5, "col");
    const first = (t as typeof nested).children[0] as Extract<
      PaneNode,
      { kind: "split" }
    >;
    expect(first.dir).toBe("col");
    expect(leafIds(first)).toEqual([1, 5]);
  });

  it("returns the tree untouched when the target is missing", () => {
    expect(splitLeaf(nested, 404, 99, 5, "row")).toBe(nested);
  });
});

describe("removeLeaf", () => {
  it("collapses a single-child split left behind", () => {
    // Removing 3 leaves the inner row with only leaf 2, which must collapse.
    const t = removeLeaf(nested, 3) as typeof nested;
    expect(leafIds(t)).toEqual([1, 2, 4]);
    expect(t.children[1].kind).toBe("leaf");
  });

  it("returns null when the last leaf goes", () => {
    expect(removeLeaf({ kind: "leaf", id: 1 }, 1)).toBeNull();
  });

  it("keeps untouched branch references intact", () => {
    const t = removeLeaf(nested, 1) as typeof nested;
    expect(t.children[0]).toBe(nested.children[1]);
  });
});

describe("nextLeafId", () => {
  it("cycles forward and backward", () => {
    expect(nextLeafId(nested, 3, 1)).toBe(4);
    expect(nextLeafId(nested, 4, 1)).toBe(1);
    expect(nextLeafId(nested, 1, -1)).toBe(4);
  });

  it("falls back to the first leaf for an unknown id", () => {
    expect(nextLeafId(nested, 404, 1)).toBe(1);
  });
});

describe("siblingLeafOf", () => {
  it("prefers the next sibling and falls back to the previous", () => {
    expect(siblingLeafOf(nested, 1)).toBe(2);
    // Leaf 3 ends its inner row, so the previous sibling (2) takes over.
    expect(siblingLeafOf(nested, 3)).toBe(2);
  });

  it("resolves inside nested splits", () => {
    expect(siblingLeafOf(nested, 2)).toBe(3);
  });

  it("returns null for a lone leaf tree", () => {
    expect(siblingLeafOf({ kind: "leaf", id: 1 }, 1)).toBeNull();
  });
});

describe("cwd helpers", () => {
  it("finds a leaf cwd anywhere in the tree", () => {
    const withCwd = setLeafCwd(nested, 3, "C:/tmp");
    expect(findLeafCwd(withCwd, 3)).toBe("C:/tmp");
    expect(hasLeaf(withCwd, 3)).toBe(true);
    expect(hasLeaf(withCwd, 404)).toBe(false);
  });

  it("reuses references when nothing changes", () => {
    // Setting the same cwd again is a no-op and returns the same object.
    const once = setLeafCwd(nested, 3, "x");
    expect(setLeafCwd(once, 3, "x")).toBe(once);
    expect(setLeafCwd(nested, 404, "x")).toBe(nested);
  });
});

describe("shell helpers", () => {
  it("splitLeaf carries the tab shell onto the new leaf", () => {
    const tree = splitLeaf(
      { kind: "leaf", id: 1 },
      1,
      80,
      81,
      "row",
      undefined,
      "wsl:Ubuntu",
    );
    expect(findLeafShell(tree, 81)).toBe("wsl:Ubuntu");
    expect(findLeafShell(tree, 1)).toBeUndefined();
  });

  it("splitLeaf without a shell leaves the field unset", () => {
    const tree = splitLeaf({ kind: "leaf", id: 1 }, 1, 80, 81, "row");
    expect(findLeafShell(tree, 81)).toBeUndefined();
  });
});

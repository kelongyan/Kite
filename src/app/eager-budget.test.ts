import { describe, expect, it } from "vitest";
import { traceEager } from "../../scripts/eager-graph-core.mjs";

// Locks the startup-bundle invariant: the heavy editor and markdown stacks
// must stay out of the eager graph of both window entries so they load only
// when the user opens those surfaces. A static import that re-introduces any of
// these (for example, a barrel re-export or a `cn`-style util getting absorbed
// into a feature chunk) will fail here. xterm is intentionally eager
// (terminal-first shell) and is not asserted against.
const HEAVY = ["streamdown", "@codemirror", "@uiw"];

function heavyEagerHits(entry: string): string[] {
  const { hits } = traceEager(entry, HEAVY);
  return [...hits.entries()].map(([pkg, info]) => `${pkg} <- ${info.file}`);
}

describe("startup bundle budget", () => {
  it("main window does not eagerly pull editor or markdown stacks", () => {
    expect(heavyEagerHits("src/main.tsx")).toEqual([]);
  });

  it("settings window does not eagerly pull editor or markdown stacks", () => {
    expect(heavyEagerHits("src/settings/main.tsx")).toEqual([]);
  });
});

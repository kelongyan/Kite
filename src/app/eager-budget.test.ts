import { describe, expect, it } from "vitest";
import { traceEager } from "../../scripts/eager-graph-core.mjs";

// Locks the startup-bundle invariant. The editor and Markdown stacks were
// removed from the project; this guards against them being reintroduced into the
// eager graph of either window entry, whether directly or through a barrel
// re-export. xterm is intentionally eager (terminal-first shell) and is not
// asserted against.
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

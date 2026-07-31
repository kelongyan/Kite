import { describe, expect, it } from "vitest";
import { resolveWindowTitle } from "./useWindowTitle";
import type { TerminalTab } from "./useTabs";

function terminalTab(over: Partial<TerminalTab> = {}): TerminalTab {
  return {
    id: 1,
    kind: "terminal",
    title: "Terminal",
    paneTree: { kind: "leaf", id: 2 },
    activeLeafId: 2,
    ...over,
  };
}

describe("resolveWindowTitle", () => {
  it("keeps the app title neutral while home is still resolving", () => {
    expect(
      resolveWindowTitle(
        terminalTab({ cwd: "C:/Users/Administrator" }),
        "C:/Users/Administrator",
        { homeResolved: false },
      ),
    ).toBe("Kite");
  });

  it("collapses to Home once the workspace home is confirmed", () => {
    expect(
      resolveWindowTitle(
        terminalTab({ cwd: "C:/Users/Administrator" }),
        "C:/Users/Administrator",
        {
          home: "C:/Users/Administrator",
          homeResolved: true,
        },
      ),
    ).toBe("Home");
  });

  it("keeps custom terminal titles when home is still resolving", () => {
    expect(
      resolveWindowTitle(
        terminalTab({ customTitle: "Server" }),
        null,
        { homeResolved: false },
      ),
    ).toBe("Server");
  });

  it("builds a joined title once both project and label are known", () => {
    expect(
      resolveWindowTitle(
        terminalTab({
          cwd: "C:/Users/Administrator/projects/kite",
        }),
        "C:/Users/Administrator/projects",
        {
          home: "C:/Users/Administrator",
          homeResolved: true,
        },
      ),
    ).toBe("projects - kite");
  });
});

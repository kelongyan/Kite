import { describe, expect, it } from "vitest";
import { labelFor } from "./tabLabel";
import type { TerminalTab } from "./useTabs";

function terminalTab(over: Partial<TerminalTab> = {}): TerminalTab {
  return {
    id: 1,
    kind: "terminal",
    title: "shell",
    paneTree: { kind: "leaf", id: 2 },
    activeLeafId: 2,
    ...over,
  };
}

describe("labelFor (terminal tabs)", () => {
  it("derives the label from the last cwd segment", () => {
    expect(labelFor(terminalTab({ cwd: "/Users/me/projects/kite" }))).toBe(
      "kite",
    );
  });

  it("falls back to the title when there is no cwd", () => {
    expect(labelFor(terminalTab({ title: "private" }))).toBe("private");
  });

  it("maps the legacy shell placeholder to Terminal", () => {
    expect(labelFor(terminalTab())).toBe("Terminal");
  });

  it("uses Home for the workspace home directory", () => {
    expect(
      labelFor(terminalTab({ cwd: "C:/Users/Administrator" }), {
        home: "C:/Users/Administrator",
      }),
    ).toBe("Home");
  });

  it("stays neutral while home is still resolving", () => {
    expect(
      labelFor(terminalTab({ cwd: "C:/Users/Administrator" }), {
        homeResolved: false,
      }),
    ).toBe("Terminal");
  });

  it("matches Windows home paths across separators and drive casing", () => {
    expect(
      labelFor(terminalTab({ cwd: "c:\\Users\\Administrator\\" }), {
        home: "C:/Users/Administrator",
      }),
    ).toBe("Home");
  });

  it("keeps root directory labels", () => {
    expect(labelFor(terminalTab({ cwd: "/" }))).toBe("/");
  });

  it("prefers a custom title over the cwd-derived name", () => {
    expect(
      labelFor(terminalTab({ cwd: "/Users/me/projects/kite", customTitle: "Server" })),
    ).toBe("Server");
  });

  it("prefers a custom title over the home label", () => {
    expect(
      labelFor(
        terminalTab({
          cwd: "C:/Users/Administrator",
          customTitle: "Server",
        }),
        { home: "C:/Users/Administrator" },
      ),
    ).toBe("Server");
  });

  it("keeps the custom title after the cwd changes (survives cd)", () => {
    const renamed = terminalTab({ cwd: "/Users/me/a", customTitle: "Server" });
    const afterCd = { ...renamed, cwd: "/Users/me/b/c" };
    expect(labelFor(afterCd)).toBe("Server");
  });

  it("handles Windows-style cwd separators", () => {
    expect(labelFor(terminalTab({ cwd: "C:\\Users\\me\\proj" }))).toBe("proj");
  });
});

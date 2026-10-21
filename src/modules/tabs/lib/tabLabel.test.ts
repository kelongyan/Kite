import { describe, expect, it } from "vitest";
import { displayPath, labelFor, pathLabelFor } from "./tabLabel";
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

describe("pathLabelFor (tab bar)", () => {
  it("shows the full path", () => {
    expect(
      pathLabelFor(terminalTab({ cwd: "/Users/me/projects/kite" })),
    ).toBe("/Users/me/projects/kite");
  });

  it("collapses the home directory to ~", () => {
    expect(
      pathLabelFor(terminalTab({ cwd: "/Users/me" }), { home: "/Users/me" }),
    ).toBe("~");
  });

  it("collapses paths inside home to ~/...", () => {
    expect(
      pathLabelFor(terminalTab({ cwd: "/Users/me/projects/kite" }), {
        home: "/Users/me/",
      }),
    ).toBe("~/projects/kite");
  });

  it("does not collapse a sibling directory with a shared prefix", () => {
    expect(
      pathLabelFor(terminalTab({ cwd: "/Users/me2/projects" }), {
        home: "/Users/me",
      }),
    ).toBe("/Users/me2/projects");
  });

  it("normalizes Windows separators and drive casing for ~", () => {
    expect(
      pathLabelFor(terminalTab({ cwd: "c:\\Users\\me\\proj" }), {
        home: "C:/Users/me",
      }),
    ).toBe("~/proj");
  });

  it("keeps the root label", () => {
    expect(pathLabelFor(terminalTab({ cwd: "/" }))).toBe("/");
    expect(pathLabelFor(terminalTab({ cwd: "D:\\" }))).toBe("D:/");
  });

  it("keeps custom titles", () => {
    expect(
      pathLabelFor(
        terminalTab({
          cwd: "/Users/me/projects/kite",
          customTitle: "Server",
        }),
        { home: "/Users/me" },
      ),
    ).toBe("Server");
  });

  it("falls back to the title without a cwd", () => {
    expect(pathLabelFor(terminalTab({ title: "private" }))).toBe("private");
  });

  it("stays neutral while home is still resolving", () => {
    expect(
      pathLabelFor(terminalTab({ cwd: "/Users/me/projects" }), {
        homeResolved: false,
      }),
    ).toBe("Terminal");
  });
});

describe("displayPath", () => {
  it("leaves paths outside home unchanged", () => {
    expect(displayPath("/opt/kite", "/Users/me")).toBe("/opt/kite");
  });

  it("normalizes backslashes and trailing separators", () => {
    expect(displayPath("C:\\Users\\me\\proj\\", "C:/Users/me")).toBe("~/proj");
  });
});

import { describe, expect, it } from "vitest";
import { buildTools, type ToolContext } from "./tools";

function context(): ToolContext {
  return {
    getCwd: () => "F:/Kite",
    getWorkspaceRoot: () => "F:/Kite",
    getTerminalContext: () => null,
    isActiveTerminalPrivate: () => false,
    injectIntoActivePty: () => false,
    openPreview: () => false,
    spawnAgent: () => null,
    readAgentOutput: () => null,
    readCache: new Map(),
    getSessionId: () => "test",
  };
}

describe("AI tool SFTP access", () => {
  it("does not expose SFTP transfer tools without an explicit approval design", () => {
    const toolNames = Object.keys(buildTools(context()));

    expect(toolNames.filter((name) => name.startsWith("sftp_"))).toEqual([]);
  });
});

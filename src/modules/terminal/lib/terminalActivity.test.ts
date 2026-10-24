import { describe, expect, it } from "vitest";
import { emitTerminalActivity, onTerminalActivity } from "./terminalActivity";

describe("terminalActivity", () => {
  it("fans events out to subscribers and stops after unsubscribe", () => {
    const seen: string[] = [];
    const off = onTerminalActivity((a) => seen.push(a.kind));
    emitTerminalActivity({ leafId: 3, kind: "output" });
    emitTerminalActivity({ leafId: 4, kind: "bell", message: "hi" });
    off();
    emitTerminalActivity({ leafId: 5, kind: "commandFinished" });
    expect(seen).toEqual(["output", "bell"]);
  });
});

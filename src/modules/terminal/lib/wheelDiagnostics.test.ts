import { afterEach, describe, expect, it, vi } from "vitest";
import {
  traceTerminalWheel,
  wheelDiagnosticsEnabled,
  wheelReportDirection,
} from "./wheelDiagnostics";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  invoke.mockReset();
});

describe("wheel-only diagnostics", () => {
  it.each([
    ["\x1b[<64;10;5M", "up"],
    ["\x1b[<65;10;5M", "down"],
    ["\x1b[<80;10;5M", "up"],
    ["\x1b[<73;10;5M", "down"],
    ["\x1b[M\x60\xc8\xff", "up"],
    ["\x1b[M\x61\xc8\xff", "down"],
  ] as const)("recognizes %j without retaining input data", (report, direction) => {
    const bytes = Uint8Array.from(report, (c) => c.charCodeAt(0));
    expect(wheelReportDirection(bytes)).toBe(direction);
  });

  it.each([
    "secret-keyboard-input",
    "\x1b[200~pasted text\x1b[201~",
    "\x1b[<0;10;5M",
    "\x1b[<35;10;5M",
    "\x1b[<66;10;5M",
    "\x1b[<64;10;5m",
    "\x1b[<64;10;5M\rpassword",
    "\x1b[M\x60\xc8\xffmore",
    "",
  ])("does not classify other input as wheel reports: %j", (input) => {
    expect(wheelReportDirection(new TextEncoder().encode(input))).toBeNull();
  });

  it("does not invoke IPC by default", () => {
    vi.stubEnv("VITE_KITE_WHEEL_DEBUG", "false");
    vi.stubGlobal("window", {});
    expect(wheelDiagnosticsEnabled()).toBe(false);
    traceTerminalWheel("dom", { deltaY: -1 });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("logs only stage and metadata when explicitly enabled", () => {
    vi.stubGlobal("window", { __kiteWheelDebug: true });
    invoke.mockResolvedValue(undefined);
    traceTerminalWheel("handler", {
      leafId: 2,
      encoding: "SGR",
      forwarded: true,
    });
    expect(invoke).toHaveBeenCalledWith("plugin:log|log", {
      level: 3,
      location: "terminal-wheel",
      message:
        '[kite-wheel] {"stage":"handler","leafId":2,"encoding":"SGR","forwarded":true}',
    });
  });
});

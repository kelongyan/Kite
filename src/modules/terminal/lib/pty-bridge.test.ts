import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openPty } from "./pty-bridge";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({
  invoke,
  Channel: class {
    onmessage = () => {};
  },
}));

beforeEach(() => {
  invoke.mockReset();
  invoke.mockImplementation((command: string) =>
    Promise.resolve(command === "pty_open" ? 7 : undefined),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PTY raw input IPC", () => {
  it("UTF-8 encodes text and passes mouse bytes unchanged with the PTY header", async () => {
    const pty = await openPty(80, 24, { onData: () => {} });
    const openCall = invoke.mock.calls.find(
      ([command]) => command === "pty_open",
    );
    expect(openCall?.[1]).toMatchObject({
      cols: 80,
      rows: 24,
      cwd: null,
      shell: null,
      themeMode: null,
    });
    expect(openCall?.[1]).not.toHaveProperty("workspace");
    await pty.write("中文");
    expect(invoke).toHaveBeenLastCalledWith(
      "pty_write",
      new TextEncoder().encode("中文"),
      { headers: { "x-pty-id": "7" } },
    );

    const bytes = new Uint8Array([27, 91, 77, 96, 200, 255]);
    await pty.write(bytes);
    expect(invoke).toHaveBeenLastCalledWith("pty_write", bytes, {
      headers: { "x-pty-id": "7" },
    });
    expect(invoke.mock.calls[invoke.mock.calls.length - 1]?.[1]).toBe(bytes);
  });

  it("records a failed wheel write without logging raw input or error details", async () => {
    vi.stubGlobal("window", { __kiteWheelDebug: true });
    const pty = await openPty(80, 24, { onData: () => {} });
    const error = new Error("private data in backend error");
    invoke.mockImplementation((command: string) =>
      command === "pty_write" ? Promise.reject(error) : Promise.resolve(),
    );
    await expect(pty.write("\x1b[<64;10;5M")).rejects.toBe(error);
    const logs = invoke.mock.calls
      .filter(([command]) => command === "plugin:log|log")
      .map(([, args]) => args.message);
    expect(logs).toEqual([
      '[kite-wheel] {"stage":"pty-write","ptyId":7,"direction":"up"}',
      '[kite-wheel] {"stage":"pty-error","ptyId":7,"direction":"up"}',
    ]);
  });
});

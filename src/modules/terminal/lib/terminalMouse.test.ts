import { SerializeAddon } from "@xterm/addon-serialize";
import { Terminal } from "@xterm/xterm";
import { describe, expect, it, vi } from "vitest";
import type { PtyInput } from "./ptyInput";
import {
  bindTerminalMouseInput,
  serializeTerminalMouseEncoding,
  terminalMouseEncoding,
} from "./terminalMouse";

function write(term: Terminal, data: string): Promise<void> {
  return new Promise((resolve) => term.write(data, resolve));
}

describe("mouse encoding snapshots", () => {
  it.each([
    ["", "DEFAULT", ""],
    ["\x1b[?1006h", "SGR", "\x1b[?1006h"],
    ["\x1b[?1016h", "SGR_PIXELS", "\x1b[?1016h"],
  ] as const)("restores %s without changing tracking or buffer", async (mode, encoding, suffix) => {
    const term = new Terminal({ allowProposedApi: true, cols: 100, rows: 30 });
    const addon = new SerializeAddon();
    term.loadAddon(addon);
    try {
      await write(term, `\x1b[?1049h\x1b[?1002h${mode}`);
      const snapshot = addon.serialize({ scrollback: 0 });
      const mouseEncoding = serializeTerminalMouseEncoding(term);
      expect(mouseEncoding).toBe(suffix);
      term.reset();
      await write(term, snapshot + mouseEncoding);
      expect(term.modes.mouseTrackingMode).toBe("drag");
      expect(term.buffer.active.type).toBe("alternate");
      expect(terminalMouseEncoding(term)).toBe(encoding);
    } finally {
      term.dispose();
    }
  });

  it("does not force SGR on an application using legacy encoding", async () => {
    const term = new Terminal();
    try {
      await write(term, "\x1b[?1000h\x1b[?1006h\x1b[?1006l");
      expect(terminalMouseEncoding(term)).toBe("DEFAULT");
      expect(serializeTerminalMouseEncoding(term)).toBe("");
    } finally {
      term.dispose();
    }
  });

  it("preserves encoding negotiated before tracking is enabled", async () => {
    const term = new Terminal();
    try {
      await write(term, "\x1b[?1006h");
      expect(term.modes.mouseTrackingMode).toBe("none");
      expect(serializeTerminalMouseEncoding(term)).toBe("\x1b[?1006h");
    } finally {
      term.dispose();
    }
  });

  it("treats missing or unknown xterm internals as legacy encoding", () => {
    expect(terminalMouseEncoding({} as Terminal)).toBe("DEFAULT");
    const term = {
      _core: { coreMouseService: { activeEncoding: "UNKNOWN" } },
    } as unknown as Terminal;
    expect(serializeTerminalMouseEncoding(term)).toBe("");
  });
});

function mouseTerminal(
  encoding = "SGR",
  tracking = "drag",
  bufferType: "normal" | "alternate" = "normal",
) {
  let onBinary: ((data: string) => void) | null = null;
  const element = Object.assign(new EventTarget(), {
    querySelector: () => ({
      getBoundingClientRect: () => ({
        left: 10,
        top: 20,
        width: 800,
        height: 480,
      }),
    }),
  });
  const options = { disableStdin: false };
  const term = {
    element,
    options,
    cols: 80,
    rows: 24,
    buffer: { active: { type: bufferType } },
    modes: { mouseTrackingMode: tracking },
    _core: { coreMouseService: { activeEncoding: encoding } },
    onBinary(callback: (data: string) => void) {
      onBinary = callback;
      return {
        dispose: () => {
          onBinary = null;
        },
      };
    },
  } as unknown as Terminal;
  const wheel = (props: Partial<WheelEvent> = {}) => {
    const event = Object.assign(
      new Event("wheel", { cancelable: true }),
      {
        clientX: 105,
        clientY: 110,
        deltaY: -1,
        shiftKey: false,
        altKey: false,
        ctrlKey: false,
      },
      props,
    );
    element.dispatchEvent(event);
    return event;
  };
  return { term, options, wheel, binary: (data: string) => onBinary?.(data) };
}

describe("terminal mouse input binding", () => {
  it("forwards small SGR wheel events using the screen geometry without private render dimensions", () => {
    const { term, wheel } = mouseTerminal();
    const send = vi.fn(() => true);
    const observe = vi.fn();
    const dispose = bindTerminalMouseInput(term, send, observe);
    try {
      expect(wheel().defaultPrevented).toBe(true);
      expect(send).toHaveBeenLastCalledWith("\x1b[<64;10;5M");
      wheel({ deltaY: 1 });
      expect(send).toHaveBeenLastCalledWith("\x1b[<65;10;5M");
      expect(send).toHaveBeenCalledTimes(2);
      expect(observe).toHaveBeenLastCalledWith(expect.any(Event), true);
    } finally {
      dispose();
    }
  });

  it.each([
    ["DEFAULT", "drag"],
    ["SGR_PIXELS", "drag"],
    ["SGR", "none"],
    ["SGR", "x10"],
  ])("lets xterm encode %s / %s events instead of forcing SGR", (encoding, tracking) => {
    const { term, wheel } = mouseTerminal(encoding, tracking);
    const send = vi.fn(() => true);
    const dispose = bindTerminalMouseInput(term, send);
    try {
      expect(wheel().defaultPrevented).toBe(false);
      expect(send).not.toHaveBeenCalled();
    } finally {
      dispose();
    }
  });

  it.each([
    { shiftKey: true },
    { altKey: true },
    { ctrlKey: true },
    { deltaY: 0 },
    { deltaY: Number.NaN },
  ])("leaves modified or non-vertical wheels to xterm: %j", (props) => {
    const { term, wheel } = mouseTerminal();
    const send = vi.fn(() => true);
    const dispose = bindTerminalMouseInput(term, send);
    try {
      expect(wheel(props).defaultPrevented).toBe(false);
      expect(send).not.toHaveBeenCalled();
    } finally {
      dispose();
    }
  });

  it.each([
    "DEFAULT",
    "SGR",
    "SGR_PIXELS",
  ])("pages untracked alternate-screen messages with %s encoding without emitting arrows", (encoding) => {
    const { term, wheel } = mouseTerminal(encoding, "none", "alternate");
    const send = vi.fn(() => true);
    const dispose = bindTerminalMouseInput(term, send);
    const nativeWheel = vi.fn();
    term.element?.addEventListener("wheel", nativeWheel);
    try {
      expect(wheel().defaultPrevented).toBe(true);
      expect(send).toHaveBeenLastCalledWith("\x1b[5~");
      expect(wheel({ deltaY: 120 }).defaultPrevented).toBe(true);
      expect(send).toHaveBeenLastCalledWith("\x1b[6~");
      expect(send).toHaveBeenCalledTimes(2);
      expect(nativeWheel).not.toHaveBeenCalled();
    } finally {
      dispose();
    }
  });

  it("pages X10 alternate screens because X10 does not report wheels", () => {
    const { term, wheel } = mouseTerminal("DEFAULT", "x10", "alternate");
    const send = vi.fn(() => true);
    const dispose = bindTerminalMouseInput(term, send);
    try {
      expect(wheel().defaultPrevented).toBe(true);
      expect(send).toHaveBeenCalledWith("\x1b[5~");
    } finally {
      dispose();
    }
  });

  it.each([
    { shiftKey: true },
    { altKey: true },
    { ctrlKey: true },
    { metaKey: true },
    { deltaY: 0 },
    { deltaY: Number.NaN },
  ])("never leaks alternate-screen wheels to arrow emulation: %j", (props) => {
    const { term, wheel } = mouseTerminal("DEFAULT", "none", "alternate");
    const send = vi.fn(() => true);
    const dispose = bindTerminalMouseInput(term, send);
    const nativeWheel = vi.fn();
    term.element?.addEventListener("wheel", nativeWheel);
    try {
      expect(wheel(props).defaultPrevented).toBe(true);
      expect(send).not.toHaveBeenCalled();
      expect(nativeWheel).not.toHaveBeenCalled();
    } finally {
      dispose();
    }
  });

  it("does not fall back to arrows when the alternate-screen owner rejects input", () => {
    const { term, wheel } = mouseTerminal("DEFAULT", "none", "alternate");
    const send = vi.fn(() => false);
    const dispose = bindTerminalMouseInput(term, send);
    try {
      expect(wheel().defaultPrevented).toBe(true);
      expect(send).toHaveBeenCalledWith("\x1b[5~");
      dispose();
      expect(wheel().defaultPrevented).toBe(false);
    } finally {
      dispose();
    }
  });

  it("routes binary events to the current owner and removes listeners on disposal", () => {
    const { term, binary, wheel } = mouseTerminal();
    const inputs: { owner: number; data: PtyInput }[] = [];
    let owner: number | null = 1;
    const dispose = bindTerminalMouseInput(term, (data) => {
      if (owner === null) return false;
      inputs.push({ owner, data });
      return true;
    });
    binary("\x1b[M\x60\xc8\xff");
    owner = 2;
    binary("\x1b[M\x61\xc8\xff");
    owner = null;
    expect(wheel().defaultPrevented).toBe(false);
    binary("ignored");
    dispose();
    owner = 3;
    binary("ignored");
    expect(wheel().defaultPrevented).toBe(false);
    expect(inputs).toEqual([
      { owner: 1, data: new Uint8Array([27, 91, 77, 96, 200, 255]) },
      { owner: 2, data: new Uint8Array([27, 91, 77, 97, 200, 255]) },
    ]);
  });

  it("does not forward mouse input for an exited terminal", () => {
    const { term, options, wheel, binary } = mouseTerminal();
    options.disableStdin = true;
    const send = vi.fn(() => true);
    const dispose = bindTerminalMouseInput(term, send);
    try {
      expect(wheel().defaultPrevented).toBe(false);
      binary("\x1b[M\x60\xc8\xff");
      expect(send).not.toHaveBeenCalled();
    } finally {
      dispose();
    }
  });
});

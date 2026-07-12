import { describe, expect, it, vi } from "vitest";
import {
  applyCursorPreferences,
  clearXtermCursorStyleOverride,
  type Slot,
  writeToSlot,
} from "./rendererPool";

const emptyFrame = "\x1b[?2026h\x1b[?2026l";

type TestSlot = Slot & { noopSynchronizedOutputPrimed: boolean };

function createTestSlot(
  writeOverride?: (data: string | Uint8Array, callback?: () => void) => void,
) {
  const writes: (string | Uint8Array)[] = [];
  const callbacks: (() => void)[] = [];
  const write =
    writeOverride ??
    ((data: string | Uint8Array, callback?: () => void) => {
      writes.push(data);
      if (callback) callbacks.push(callback);
    });
  const term = {
    buffer: { active: { type: "alternate" } },
    modes: { synchronizedOutputMode: false },
    write,
  };
  const slot = {
    term,
    pendingTerminalWrites: 0,
    noopSynchronizedOutputPrimed: false,
    cursorOverlayRaf: null,
  } as unknown as TestSlot;
  return { slot, writes, callbacks };
}

describe("writeToSlot synchronized output", () => {
  it("writes one priming frame before dropping a continuous empty-frame run", () => {
    const { slot, writes, callbacks } = createTestSlot();

    writeToSlot(slot, emptyFrame);
    expect(writes).toHaveLength(1);

    writeToSlot(slot, emptyFrame);
    expect(writes).toHaveLength(2);

    callbacks.shift()?.();
    callbacks.shift()?.();
    expect(slot.pendingTerminalWrites).toBe(0);
    expect(slot.noopSynchronizedOutputPrimed).toBe(true);

    writeToSlot(slot, emptyFrame);
    expect(writes).toHaveLength(2);

    writeToSlot(slot, "updated");
    callbacks.shift()?.();
    expect(slot.noopSynchronizedOutputPrimed).toBe(false);

    writeToSlot(slot, emptyFrame);
    expect(writes).toHaveLength(4);
  });

  it("releases the pending count when xterm rejects a write synchronously", () => {
    const error = new Error("write failed");
    const { slot } = createTestSlot(() => {
      throw error;
    });

    expect(() => writeToSlot(slot, "updated")).toThrow(error);
    expect(slot.pendingTerminalWrites).toBe(0);
  });

  it("waits for xterm parsing before syncing an overlay cursor visibility change", () => {
    const requestAnimationFrame = vi.fn(() => 1);
    vi.stubGlobal("requestAnimationFrame", requestAnimationFrame);
    applyCursorPreferences("bar", "expand", 1);

    try {
      const { slot } = createTestSlot();
      writeToSlot(slot, "\x1b[?25l");
      expect(requestAnimationFrame).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("overlay cursor ownership", () => {
  it("clears TUI cursor style overrides before Kite takes over rendering", () => {
    const modes = { cursorStyle: "block", cursorBlink: true };
    const term = { _core: { coreService: { decPrivateModes: modes } } };

    clearXtermCursorStyleOverride(term as never);

    expect(modes.cursorStyle).toBeUndefined();
    expect(modes.cursorBlink).toBeUndefined();
  });
});

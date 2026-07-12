import { describe, expect, it } from "vitest";
import { shouldDropNoopSynchronizedOutput } from "./synchronizedOutput";

const begin = "\x1b[?2026h";
const end = "\x1b[?2026l";
const emptyFrame = `${begin}${end}`;

describe("shouldDropNoopSynchronizedOutput", () => {
  const alternateScreen = {
    alternateScreen: true,
    synchronizedOutputActive: false,
    pendingTerminalWrites: 0,
    noopSynchronizedOutputPrimed: true,
  };

  it("drops empty synchronized-output frames in an alternate-screen TUI", () => {
    expect(shouldDropNoopSynchronizedOutput(emptyFrame, alternateScreen)).toBe(
      true,
    );
    expect(
      shouldDropNoopSynchronizedOutput(
        new TextEncoder().encode(emptyFrame.repeat(3)),
        alternateScreen,
      ),
    ).toBe(true);
  });

  it("keeps frames that carry terminal output", () => {
    expect(
      shouldDropNoopSynchronizedOutput(
        `${begin}updated${end}`,
        alternateScreen,
      ),
    ).toBe(false);
    expect(
      shouldDropNoopSynchronizedOutput(`${emptyFrame}updated`, alternateScreen),
    ).toBe(false);
  });

  it("keeps empty frames outside alternate screen or while sync is active", () => {
    expect(
      shouldDropNoopSynchronizedOutput(emptyFrame, {
        alternateScreen: false,
        synchronizedOutputActive: false,
        pendingTerminalWrites: 0,
        noopSynchronizedOutputPrimed: true,
      }),
    ).toBe(false);
    expect(
      shouldDropNoopSynchronizedOutput(emptyFrame, {
        alternateScreen: true,
        synchronizedOutputActive: true,
        pendingTerminalWrites: 0,
        noopSynchronizedOutputPrimed: true,
      }),
    ).toBe(false);
  });

  it("keeps empty frames while an earlier terminal write is still pending", () => {
    const pendingWriteContext = {
      ...alternateScreen,
      pendingTerminalWrites: 1,
    };
    expect(
      shouldDropNoopSynchronizedOutput(emptyFrame, pendingWriteContext),
    ).toBe(false);
  });

  it("keeps the first empty frame until the parser boundary is primed", () => {
    const unprimedContext = {
      ...alternateScreen,
      noopSynchronizedOutputPrimed: false,
    };
    expect(shouldDropNoopSynchronizedOutput(emptyFrame, unprimedContext)).toBe(
      false,
    );
  });

  it("keeps incomplete and unrelated control sequences", () => {
    expect(shouldDropNoopSynchronizedOutput(begin, alternateScreen)).toBe(
      false,
    );
    expect(shouldDropNoopSynchronizedOutput(end, alternateScreen)).toBe(false);
    expect(
      shouldDropNoopSynchronizedOutput("\x1b[?25l\x1b[?25h", alternateScreen),
    ).toBe(false);
    expect(shouldDropNoopSynchronizedOutput("", alternateScreen)).toBe(false);
  });
});

// Wheel routing for Kite's pooled terminals.
//
// Mouse-tracking apps (pi, htop, lazygit) expect SGR wheel reports, so those
// are forwarded instead of walking xterm's private coordinate checks, which
// drop the event when the pooled renderer has no measured dimensions.
// An alternate screen with no wheel reporting cannot scroll locally, and
// xterm's fallback would send arrow keys that TUI agents treat as input
// history, so wheel notches become PageUp/PageDown instead.

type MouseTrackingMode = "none" | "x10" | "vt200" | "drag" | "any";

const SGR_WHEEL_UP = 64;
const SGR_WHEEL_DOWN = 65;

export type WheelForwardInput = {
  mouseTrackingMode: MouseTrackingMode;
  alternateScreen: boolean;
  deltaY: number;
  shiftKey: boolean;
  col: number;
  row: number;
};

export function resolveWheelForward(input: WheelForwardInput): string | null {
  const { mouseTrackingMode, alternateScreen, deltaY, shiftKey, col, row } =
    input;
  if (shiftKey || !Number.isFinite(deltaY) || deltaY === 0) return null;
  if (mouseTrackingMode === "none" || mouseTrackingMode === "x10") {
    // Arrow keys recall the editor's input history in full-screen agents.
    return alternateScreen ? (deltaY < 0 ? "\x1b[5~" : "\x1b[6~") : null;
  }
  const button = deltaY < 0 ? SGR_WHEEL_UP : SGR_WHEEL_DOWN;
  return `\x1b[<${button};${clampCell(col)};${clampCell(row)}M`;
}

function clampCell(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.trunc(value));
}

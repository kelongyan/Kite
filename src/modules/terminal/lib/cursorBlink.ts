import type { TerminalCursorAnimation } from "./cursorStyle";

export function shouldCursorBlink(
  animation: TerminalCursorAnimation,
  windowActive: boolean,
  slotFocused: boolean,
): boolean {
  return animation === "blink" && windowActive && slotFocused;
}

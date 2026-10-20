import type { Terminal } from "@xterm/xterm";
import { binaryPtyInput, type PtyInput } from "./ptyInput";
import { resolveWheelForward } from "./wheelForward";

// xterm's public modes and SerializeAddon omit the negotiated mouse encoding.
// Keep this version-specific access at the terminal boundary.
type MouseEncoding = "DEFAULT" | "SGR" | "SGR_PIXELS";
type MouseTerminal = Terminal & {
  _core?: { coreMouseService?: { activeEncoding?: string } };
};

export function terminalMouseEncoding(term: Terminal): MouseEncoding {
  const encoding = (term as MouseTerminal)._core?.coreMouseService
    ?.activeEncoding;
  return encoding === "SGR" || encoding === "SGR_PIXELS" ? encoding : "DEFAULT";
}

export function serializeTerminalMouseEncoding(term: Terminal): string {
  switch (terminalMouseEncoding(term)) {
    case "SGR":
      return "\x1b[?1006h";
    case "SGR_PIXELS":
      return "\x1b[?1016h";
    default:
      return "";
  }
}

export function bindTerminalMouseInput(
  term: Terminal,
  sendInput: (data: PtyInput) => boolean,
  observeWheel?: (event: WheelEvent, forwarded: boolean) => void,
): () => void {
  const binary = term.onBinary((data) => {
    if (!term.options.disableStdin) sendInput(binaryPtyInput(data));
  });
  const element = term.element;
  const onWheel = (event: WheelEvent) => {
    let forwarded = false;
    const tracking = term.modes.mouseTrackingMode;
    const alternateScreen = term.buffer.active.type === "alternate";
    const wheelTracking = tracking !== "none" && tracking !== "x10";
    const alternatePaging = alternateScreen && !wheelTracking;
    if (
      !term.options.disableStdin &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey &&
      Number.isFinite(event.deltaY) &&
      event.deltaY !== 0
    ) {
      const screen = element?.querySelector(".xterm-screen") ?? element;
      const rect = screen?.getBoundingClientRect();
      if (
        alternatePaging ||
        (wheelTracking &&
          terminalMouseEncoding(term) === "SGR" &&
          rect &&
          rect.width > 0 &&
          rect.height > 0)
      ) {
        const col = rect?.width
          ? Math.min(
              term.cols,
              Math.max(
                1,
                Math.floor(
                  ((event.clientX - rect.left) * term.cols) / rect.width,
                ) + 1,
              ),
            )
          : 1;
        const row = rect?.height
          ? Math.min(
              term.rows,
              Math.max(
                1,
                Math.floor(
                  ((event.clientY - rect.top) * term.rows) / rect.height,
                ) + 1,
              ),
            )
          : 1;
        const report = resolveWheelForward({
          mouseTrackingMode: tracking,
          alternateScreen,
          deltaY: event.deltaY,
          shiftKey: event.shiftKey,
          col,
          row,
        });
        if (report !== null) forwarded = sendInput(report);
      }
    }
    if (forwarded || alternatePaging) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    observeWheel?.(event, forwarded);
  };
  // Capture before xterm can turn an untracked alternate-screen wheel into arrows.
  element?.addEventListener("wheel", onWheel, {
    capture: true,
    passive: false,
  });
  return () => {
    binary.dispose();
    element?.removeEventListener("wheel", onWheel, { capture: true });
  };
}

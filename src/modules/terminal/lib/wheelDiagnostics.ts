import { invoke } from "@tauri-apps/api/core";

export function wheelDiagnosticsEnabled(): boolean {
  return (
    import.meta.env?.VITE_KITE_WHEEL_DEBUG === "true" ||
    (typeof window !== "undefined" &&
      (window as unknown as { __kiteWheelDebug?: boolean }).__kiteWheelDebug ===
        true)
  );
}

type WheelDetails = {
  slotId?: number;
  leafId?: number | null;
  ptyId?: number;
  deltaY?: number;
  deltaMode?: number;
  shift?: boolean;
  ctrl?: boolean;
  alt?: boolean;
  tracking?: string;
  encoding?: string;
  forwarded?: boolean;
  direction?: "up" | "down";
};

export function traceTerminalWheel(
  stage: "dom" | "handler" | "pty-write" | "pty-written" | "pty-error",
  details: WheelDetails,
): void {
  if (!wheelDiagnosticsEnabled()) return;
  // Only mouse metadata is allowed here, never keyboard/paste data or errors.
  void invoke("plugin:log|log", {
    level: 3,
    message: `[kite-wheel] ${JSON.stringify({ stage, ...details })}`,
    location: "terminal-wheel",
  }).catch(() => {});
}

let bound = false;
export function bindWheelDiagnostics(): void {
  if (bound || typeof document === "undefined") return;
  bound = true;
  document.addEventListener(
    "wheel",
    (event) => {
      if (!wheelDiagnosticsEnabled()) return;
      const target = event.target;
      const slotId =
        target instanceof Element
          ? target.closest<HTMLElement>("[data-kite-slot]")?.dataset.kiteSlot
          : undefined;
      traceTerminalWheel("dom", {
        slotId: slotId === undefined ? -1 : Number(slotId),
        deltaY: event.deltaY,
        deltaMode: event.deltaMode,
        shift: event.shiftKey,
        ctrl: event.ctrlKey,
        alt: event.altKey,
      });
    },
    { capture: true, passive: true },
  );
}

export function wheelReportDirection(bytes: Uint8Array): "up" | "down" | null {
  let button: number;
  if (
    bytes.length === 6 &&
    bytes[0] === 27 &&
    bytes[1] === 91 &&
    bytes[2] === 77
  ) {
    button = bytes[3] - 32;
  } else {
    if (
      bytes.length > 64 ||
      bytes[0] !== 27 ||
      bytes[1] !== 91 ||
      bytes[2] !== 60
    ) {
      return null;
    }
    const report = new TextDecoder().decode(bytes);
    const match = /^\x1b\[<(\d+);\d+;\d+M$/.exec(report);
    if (!match) return null;
    button = Number(match[1]);
  }
  const baseButton = button & ~28;
  return baseButton === 64 ? "up" : baseButton === 65 ? "down" : null;
}

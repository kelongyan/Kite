type SynchronizedOutputContext = {
  alternateScreen: boolean;
  synchronizedOutputActive: boolean;
  pendingTerminalWrites: number;
  noopSynchronizedOutputPrimed: boolean;
};

const EMPTY_SYNCHRONIZED_OUTPUT_FRAME = "\x1b[?2026h\x1b[?2026l";

export function isNoopSynchronizedOutputFrame(
  data: string | Uint8Array,
): boolean {
  if (
    data.length === 0 ||
    data.length % EMPTY_SYNCHRONIZED_OUTPUT_FRAME.length !== 0
  ) {
    return false;
  }

  for (let offset = 0; offset < data.length; offset += 1) {
    const expected = EMPTY_SYNCHRONIZED_OUTPUT_FRAME.charCodeAt(
      offset % EMPTY_SYNCHRONIZED_OUTPUT_FRAME.length,
    );
    const actual =
      typeof data === "string" ? data.charCodeAt(offset) : data[offset];
    if (actual !== expected) return false;
  }

  return true;
}

export function shouldDropNoopSynchronizedOutput(
  data: string | Uint8Array,
  context: SynchronizedOutputContext,
): boolean {
  if (
    !context.alternateScreen ||
    context.synchronizedOutputActive ||
    context.pendingTerminalWrites > 0 ||
    !context.noopSynchronizedOutputPrimed ||
    !isNoopSynchronizedOutputFrame(data)
  ) {
    return false;
  }
  return true;
}

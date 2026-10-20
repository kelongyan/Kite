export type PtyInput = string | Uint8Array;

const textEncoder = new TextEncoder();
const PENDING_INPUT_MAX_BYTES = 256 * 1024;

export function encodePtyInput(data: PtyInput): Uint8Array {
  return typeof data === "string" ? textEncoder.encode(data) : data;
}

// xterm's onBinary strings contain bytes, not Unicode text.
export function binaryPtyInput(data: string): Uint8Array {
  return Uint8Array.from(data, (character) => character.charCodeAt(0));
}

export class PendingPtyInput {
  private buffer = new Uint8Array(0);
  private size = 0;

  constructor(private readonly maxBytes = PENDING_INPUT_MAX_BYTES) {}

  push(data: PtyInput): boolean {
    if (data.length > this.maxBytes - this.size) return false;
    const bytes = encodePtyInput(data);
    if (bytes.length > this.maxBytes - this.size) return false;
    const size = this.size + bytes.length;
    if (size > this.buffer.length) {
      const capacity = Math.min(
        this.maxBytes,
        Math.max(1024, size, this.buffer.length * 2),
      );
      const buffer = new Uint8Array(capacity);
      buffer.set(this.buffer.subarray(0, this.size));
      this.buffer = buffer;
    }
    this.buffer.set(bytes, this.size);
    this.size = size;
    return true;
  }

  drain(): Uint8Array | null {
    if (this.size === 0) return null;
    const bytes = this.buffer.subarray(0, this.size);
    this.clear();
    return bytes;
  }

  clear(): void {
    this.buffer = new Uint8Array(0);
    this.size = 0;
  }
}

import { describe, expect, it } from "vitest";
import { binaryPtyInput, encodePtyInput, PendingPtyInput } from "./ptyInput";

describe("PTY input encoding", () => {
  it("encodes keyboard and pasted Unicode as UTF-8", () => {
    expect(encodePtyInput("中文😀")).toEqual(
      new TextEncoder().encode("中文😀"),
    );
  });

  it("preserves legacy mouse coordinates above 127 as single bytes", () => {
    const input = "\x1b[M\x60\xc8\xff";
    const bytes = binaryPtyInput(input);
    expect([...bytes]).toEqual([27, 91, 77, 96, 200, 255]);
    expect(encodePtyInput(bytes)).toBe(bytes);
    expect(encodePtyInput(input)).not.toEqual(bytes);
  });
});

describe("PendingPtyInput", () => {
  it("preserves mixed text and binary input order in one raw write", () => {
    const queue = new PendingPtyInput();
    queue.push("中");
    queue.push(binaryPtyInput("\x1b[M\x60\xc8\xff"));
    queue.push("\r");

    expect(queue.drain()).toEqual(
      new Uint8Array([0xe4, 0xb8, 0xad, 27, 91, 77, 96, 200, 255, 13]),
    );
    expect(queue.drain()).toBeNull();
  });

  it("caps queued input by UTF-8 bytes without keeping a partial sequence", () => {
    const queue = new PendingPtyInput(5);
    expect(queue.push("中")).toBe(true);
    expect(queue.push("文")).toBe(false);
    expect(queue.push(new Uint8Array([200, 255]))).toBe(true);
    expect(queue.push("x")).toBe(false);
    expect(queue.drain()).toEqual(new Uint8Array([0xe4, 0xb8, 0xad, 200, 255]));
    expect(queue.push("文")).toBe(true);
  });

  it("owns queued binary data until the PTY attaches", () => {
    const queue = new PendingPtyInput();
    const bytes = new Uint8Array([200, 255]);
    queue.push(bytes);
    bytes.fill(0);
    expect(queue.drain()).toEqual(new Uint8Array([200, 255]));
  });

  it("clears queued input on exit or respawn", () => {
    const queue = new PendingPtyInput(3);
    queue.push("中");
    queue.clear();
    expect(queue.drain()).toBeNull();
    expect(queue.push("文")).toBe(true);
  });

  it("ignores empty input and rejects a single oversized paste", () => {
    const queue = new PendingPtyInput(4);
    expect(queue.push("")).toBe(true);
    expect(queue.push(new Uint8Array())).toBe(true);
    expect(queue.push("abcde")).toBe(false);
    expect(queue.drain()).toBeNull();
  });
});

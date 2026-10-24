import { describe, expect, it, vi } from "vitest";
import type { Terminal } from "@xterm/xterm";
import { registerOscNotificationHandler } from "./osc-handlers";

type Handler = (data: string) => boolean;

function fakeTerm() {
  const handlers = new Map<number, Handler>();
  const term = {
    parser: {
      registerOscHandler: (code: number, h: Handler) => {
        handlers.set(code, h);
        return { dispose: () => handlers.delete(code) };
      },
    },
  } as unknown as Terminal;
  return { term, fire: (code: number, data: string) => handlers.get(code)?.(data) ?? false };
}

describe("registerOscNotificationHandler", () => {
  it("surfaces OSC 9 plain text and strips control characters", () => {
    const { term, fire } = fakeTerm();
    const onNotify = vi.fn();
    registerOscNotificationHandler(term, onNotify);

    expect(fire(9, "build failed")).toBe(true);
    expect(onNotify).toHaveBeenCalledWith("build failed");

    onNotify.mockClear();
    expect(fire(9, "x\x1b]52;pwned")).toBe(true);
    expect(onNotify).toHaveBeenCalledWith("x ]52;pwned");
  });

  it("ignores Windows Terminal progress OSC 9;5", () => {
    const { term, fire } = fakeTerm();
    const onNotify = vi.fn();
    registerOscNotificationHandler(term, onNotify);

    expect(fire(9, "5;42")).toBe(false);
    expect(onNotify).not.toHaveBeenCalled();
  });

  it("surfaces OSC 777 notify title and body", () => {
    const { term, fire } = fakeTerm();
    const onNotify = vi.fn();
    registerOscNotificationHandler(term, onNotify);

    expect(fire(777, "notify;Deploy;finished ok")).toBe(true);
    expect(onNotify).toHaveBeenCalledWith("finished ok");

    onNotify.mockClear();
    expect(fire(777, "notify;OnlyTitle")).toBe(true);
    expect(onNotify).toHaveBeenCalledWith("OnlyTitle");

    onNotify.mockClear();
    // Non-notify OSC 777 (e.g. progress) belongs to other consumers.
    expect(fire(777, "progress;50")).toBe(false);
    expect(onNotify).not.toHaveBeenCalled();
  });
});

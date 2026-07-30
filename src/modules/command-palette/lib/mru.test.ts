import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mruSnapshot, recordUse } from "./mru";

const values = new Map<string, string>();

beforeEach(() => {
  values.clear();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("command palette MRU storage", () => {
  it("copies legacy data into the Kite key when first read", () => {
    values.set("terax-palette-mru", JSON.stringify({ settings: 42 }));

    expect(mruSnapshot()).toEqual({ settings: 42 });
    expect(values.get("kite-palette-mru")).toBe(
      JSON.stringify({ settings: 42 }),
    );
  });

  it("prefers Kite data over legacy data", () => {
    values.set("kite-palette-mru", JSON.stringify({ current: 9 }));
    values.set("terax-palette-mru", JSON.stringify({ legacy: 4 }));

    expect(mruSnapshot()).toEqual({ current: 9 });
    recordUse("next");
    expect(JSON.parse(values.get("kite-palette-mru") ?? "{}")).toMatchObject({
      current: 9,
      next: expect.any(Number),
    });
  });
});

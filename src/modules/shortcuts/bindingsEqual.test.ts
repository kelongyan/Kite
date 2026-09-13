import { describe, expect, it } from "vitest";
import { bindingsEqual, SHORTCUTS } from "./shortcuts";

describe("bindingsEqual", () => {
  it("matches identical bindings", () => {
    expect(bindingsEqual({ key: "p", ctrl: true }, { key: "p", ctrl: true })).toBe(
      true,
    );
  });

  it("ignores key case", () => {
    expect(bindingsEqual({ key: "P", ctrl: true }, { key: "p", ctrl: true })).toBe(
      true,
    );
  });

  it("treats explicit false and omitted modifiers as equal", () => {
    expect(
      bindingsEqual(
        { key: "p", ctrl: true, shift: false, alt: false, meta: false },
        { key: "p", ctrl: true },
      ),
    ).toBe(true);
  });

  it("rejects different modifiers", () => {
    expect(
      bindingsEqual({ key: "d", ctrl: true }, { key: "d", ctrl: true, shift: true }),
    ).toBe(false);
  });

  it("rejects different keys", () => {
    expect(bindingsEqual({ key: "t", ctrl: true }, { key: "w", ctrl: true })).toBe(
      false,
    );
  });

  it("finds conflicts against the default shortcut table", () => {
    const newTab = SHORTCUTS.find((s) => s.id === "tab.new");
    const closeTab = SHORTCUTS.find((s) => s.id === "tab.close");
    expect(newTab?.defaultBindings[0]).toBeDefined();
    expect(closeTab?.defaultBindings[0]).toBeDefined();
    expect(
      bindingsEqual(
        newTab?.defaultBindings[0] ?? { key: "" },
        closeTab?.defaultBindings[0] ?? { key: "" },
      ),
    ).toBe(false);
  });
});

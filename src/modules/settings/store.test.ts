import { beforeEach, describe, expect, it, vi } from "vitest";

const storeMock = vi.hoisted(() => ({
  entries: vi.fn<() => Promise<[string, unknown][]>>(),
  set: vi.fn<(key: string, value: unknown) => Promise<void>>(),
  save: vi.fn<() => Promise<void>>(),
  onChange: vi.fn<
    (cb: (key: string, value: unknown) => void) => Promise<() => void>
  >(),
}));

vi.mock("@tauri-apps/plugin-store", () => ({
  LazyStore: vi.fn(function LazyStore() {
    return storeMock;
  }),
}));

vi.mock("@tauri-apps/api/event", () => ({
  emit: vi.fn<() => Promise<void>>(),
  listen: vi.fn<() => Promise<() => void>>(() => Promise.resolve(vi.fn())),
}));

async function loadStoreWithEntries(entries: [string, unknown][]) {
  vi.resetModules();
  storeMock.entries.mockResolvedValue(entries);
  storeMock.set.mockResolvedValue();
  storeMock.save.mockResolvedValue();
  storeMock.onChange.mockResolvedValue(vi.fn());
  return import("./store");
}

describe("loadPreferences", () => {
  beforeEach(() => {
    storeMock.entries.mockReset();
    storeMock.set.mockReset();
    storeMock.save.mockReset();
    storeMock.onChange.mockReset();
  });

  it("uses the fixed terminal cursor defaults instead of legacy cursor preferences", async () => {
    const { DEFAULT_PREFERENCES, loadPreferences } = await loadStoreWithEntries([
      ["terminalCursorShape", "block"],
      ["terminalCursorAnimation", "steady"],
      ["terminalCursorWidth", 4],
    ]);

    const prefs = await loadPreferences();

    expect(prefs.terminalCursorShape).toBe(
      DEFAULT_PREFERENCES.terminalCursorShape,
    );
    expect(prefs.terminalCursorAnimation).toBe("expand");
    expect(prefs.terminalCursorWidth).toBe(
      DEFAULT_PREFERENCES.terminalCursorWidth,
    );
  });
});

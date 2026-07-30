import { beforeEach, describe, expect, it, vi } from "vitest";

const storeMock = vi.hoisted(() => ({
  entries: vi.fn<() => Promise<[string, unknown][]>>(),
  set: vi.fn<(key: string, value: unknown) => Promise<void>>(),
  delete: vi.fn<(key: string) => Promise<boolean>>(),
  save: vi.fn<() => Promise<void>>(),
  onChange:
    vi.fn<(cb: (key: string, value: unknown) => void) => Promise<() => void>>(),
}));

const legacyStoreMock = vi.hoisted(() => ({
  entries: vi.fn<() => Promise<[string, unknown][]>>(),
  set: vi.fn<(key: string, value: unknown) => Promise<void>>(),
  delete: vi.fn<(key: string) => Promise<boolean>>(),
  save: vi.fn<() => Promise<void>>(),
  onChange:
    vi.fn<(cb: (key: string, value: unknown) => void) => Promise<() => void>>(),
}));

vi.mock("@tauri-apps/plugin-store", () => ({
  LazyStore: vi.fn(function LazyStore(path: string) {
    return path === "terax-settings.json" ? legacyStoreMock : storeMock;
  }),
}));

vi.mock("@tauri-apps/api/event", () => ({
  emit: vi.fn<() => Promise<void>>(),
  listen: vi.fn<() => Promise<() => void>>(() => Promise.resolve(vi.fn())),
}));

async function loadStoreWithEntries(entries: [string, unknown][]) {
  vi.resetModules();
  storeMock.entries.mockResolvedValue(entries);
  legacyStoreMock.entries.mockResolvedValue([]);
  storeMock.set.mockResolvedValue();
  storeMock.delete.mockResolvedValue(true);
  storeMock.save.mockResolvedValue();
  storeMock.onChange.mockResolvedValue(vi.fn());
  legacyStoreMock.set.mockResolvedValue();
  legacyStoreMock.delete.mockResolvedValue(true);
  legacyStoreMock.save.mockResolvedValue();
  legacyStoreMock.onChange.mockResolvedValue(vi.fn());
  return import("./store");
}

describe("loadPreferences", () => {
  beforeEach(() => {
    storeMock.entries.mockReset();
    storeMock.set.mockReset();
    storeMock.delete.mockReset();
    storeMock.save.mockReset();
    storeMock.onChange.mockReset();
    legacyStoreMock.entries.mockReset();
    legacyStoreMock.set.mockReset();
    legacyStoreMock.delete.mockReset();
    legacyStoreMock.save.mockReset();
    legacyStoreMock.onChange.mockReset();
  });

  it("uses the fixed terminal cursor defaults instead of legacy cursor preferences", async () => {
    const { DEFAULT_PREFERENCES, loadPreferences } = await loadStoreWithEntries(
      [
        ["terminalCursorShape", "block"],
        ["terminalCursorAnimation", "steady"],
        ["terminalCursorWidth", 4],
      ],
    );

    const prefs = await loadPreferences();

    expect(prefs.terminalCursorShape).toBe(
      DEFAULT_PREFERENCES.terminalCursorShape,
    );
    expect(prefs.terminalCursorAnimation).toBe("expand");
    expect(prefs.terminalCursorWidth).toBe(
      DEFAULT_PREFERENCES.terminalCursorWidth,
    );
  });

  it("migrates the legacy default theme id to the Kite id", async () => {
    const { loadPreferences } = await loadStoreWithEntries([
      ["_version", 1],
      ["themeId", "terax-default"],
    ]);

    const prefs = await loadPreferences();

    expect(prefs.themeId).toBe("kite-default");
    expect(storeMock.set).toHaveBeenCalledWith("themeId", "kite-default");
    expect(storeMock.set).toHaveBeenCalledWith("_version", 3);
  });

  it("falls back to the legacy settings file only when the Kite store is empty", async () => {
    const { loadPreferences } = await loadStoreWithEntries([]);
    legacyStoreMock.entries.mockResolvedValue([
      ["_version", 1],
      ["themeId", "terax-default"],
    ]);

    const prefs = await loadPreferences();

    expect(prefs.themeId).toBe("kite-default");
    expect(storeMock.set).toHaveBeenCalledWith("themeId", "kite-default");
    expect(storeMock.save).toHaveBeenCalled();
  });

  it("removes retired background preferences during migration", async () => {
    const { loadPreferences } = await loadStoreWithEntries([
      ["_version", 2],
      ["backgroundKind", "image"],
      ["backgroundImageId", "old-image"],
      ["backgroundOpacity", 0.9],
      ["backgroundBlur", 12],
    ]);

    const prefs = await loadPreferences();

    expect("backgroundKind" in prefs).toBe(false);
    expect(storeMock.delete).toHaveBeenCalledWith("backgroundKind");
    expect(storeMock.delete).toHaveBeenCalledWith("backgroundImageId");
    expect(storeMock.delete).toHaveBeenCalledWith("backgroundOpacity");
    expect(storeMock.delete).toHaveBeenCalledWith("backgroundBlur");
    expect(storeMock.set).toHaveBeenCalledWith("_version", 3);
  });
});

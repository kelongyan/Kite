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

  it("loads the hidden smooth caret animation preference", async () => {
    const { loadPreferences } = await loadStoreWithEntries([
      ["_version", 6],
      ["terminalCursorSmoothCaretAnimation", "on"],
    ]);

    const prefs = await loadPreferences();

    expect(prefs.terminalCursorSmoothCaretAnimation).toBe("on");
  });

  it("falls back for invalid smooth caret animation preferences", async () => {
    const { loadPreferences } = await loadStoreWithEntries([
      ["_version", 6],
      ["terminalCursorSmoothCaretAnimation", "always"],
    ]);

    const prefs = await loadPreferences();

    expect(prefs.terminalCursorSmoothCaretAnimation).toBe("explicit");
  });

  it("migrates the legacy default theme id to the Kite id", async () => {
    const { loadPreferences } = await loadStoreWithEntries([
      ["_version", 1],
      ["themeId", "terax-default"],
    ]);

    const prefs = await loadPreferences();

    expect(prefs.themeId).toBe("kite-default");
    expect(storeMock.set).toHaveBeenCalledWith("themeId", "kite-default");
    expect(storeMock.set).toHaveBeenCalledWith("_version", 10);
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
    expect(storeMock.set).toHaveBeenCalledWith("_version", 10);
  });

  it("removes retired explorer git decoration preference during migration", async () => {
    const { loadPreferences } = await loadStoreWithEntries([
      ["_version", 3],
      ["explorerGitDecorations", true],
    ]);

    const prefs = await loadPreferences();

    expect("explorerGitDecorations" in prefs).toBe(false);
    expect(storeMock.delete).toHaveBeenCalledWith("explorerGitDecorations");
    expect(storeMock.set).toHaveBeenCalledWith("_version", 10);
  });

  it("removes the retired header search shortcut during migration", async () => {
    const { loadPreferences } = await loadStoreWithEntries([
      ["_version", 4],
      ["shortcuts", { "search.focus": [{ ctrl: true, key: "f" }] }],
    ]);

    const prefs = await loadPreferences();

    expect("search.focus" in prefs.shortcuts).toBe(false);
    expect(storeMock.set).toHaveBeenCalledWith("shortcuts", {});
    expect(storeMock.set).toHaveBeenCalledWith("_version", 10);
  });

  it("normalizes retired builtin app themes during migration", async () => {
    const { loadPreferences } = await loadStoreWithEntries([
      ["_version", 5],
      ["themeId", "sage"],
    ]);

    const prefs = await loadPreferences();

    expect(prefs.themeId).toBe("kite-default");
    expect(storeMock.set).toHaveBeenCalledWith("themeId", "kite-default");
    expect(storeMock.set).toHaveBeenCalledWith("_version", 10);
  });

  it("keeps the id of a builtin theme that still ships", async () => {
    const { loadPreferences } = await loadStoreWithEntries([
      ["_version", 8],
      ["themeId", "kanagawa"],
    ]);

    const prefs = await loadPreferences();

    expect(prefs.themeId).toBe("kanagawa");
  });

  it("migrates the former recommended font stack into separate fields", async () => {
    const { loadPreferences } = await loadStoreWithEntries([
      ["_version", 8],
      ["terminalFontFamily", "JetBrains Mono, 'Microsoft YaHei', monospace"],
    ]);

    const prefs = await loadPreferences();

    expect(prefs.terminalFontFamily).toBe("JetBrains Mono");
    expect(prefs.terminalCjkFontFamily).toBe("Microsoft YaHei");
    expect(storeMock.set).toHaveBeenCalledWith(
      "terminalCjkFontFamily",
      "Microsoft YaHei",
    );
    expect(storeMock.set).toHaveBeenCalledWith("_version", 10);
  });

  it("migrates the retired Monaco default to the bundled mono font", async () => {
    // "Monaco" was the pre-v1 default. The commit-time normalize no longer
    // rewrites it, so this migration is the only place old stores are cleaned.
    const { loadPreferences } = await loadStoreWithEntries([
      ["_version", 8],
      ["terminalFontFamily", "Monaco"],
    ]);

    const prefs = await loadPreferences();

    expect(prefs.terminalFontFamily).toBe("JetBrains Mono");
    expect(prefs.terminalCjkFontFamily).toBe("Noto Sans SC");
    expect(storeMock.set).toHaveBeenCalledWith(
      "terminalFontFamily",
      "JetBrains Mono",
    );
    expect(storeMock.set).toHaveBeenCalledWith("_version", 10);
  });

  it("keeps a Monaco family stored by a post-migration commit", async () => {
    // A v10 store holds whatever the user committed; loading must not treat
    // it as the retired sentinel (that was the pre-fix bug).
    const { loadPreferences } = await loadStoreWithEntries([
      ["_version", 10],
      ["terminalFontFamily", "Monaco"],
      ["terminalCjkFontFamily", "Noto Sans SC"],
    ]);

    const prefs = await loadPreferences();

    expect(prefs.terminalFontFamily).toBe("Monaco");
    expect(storeMock.set).not.toHaveBeenCalled();
  });

  it("preserves ambiguous legacy font stacks during migration", async () => {
    const { loadPreferences } = await loadStoreWithEntries([
      ["_version", 8],
      ["terminalFontFamily", "Foo, Bar, monospace"],
    ]);

    const prefs = await loadPreferences();

    expect(prefs.terminalFontFamily).toBe("Foo, Bar, monospace");
    expect(prefs.terminalCjkFontFamily).toBe("Noto Sans SC");
  });

  it("fills the empty CJK sentinel with the Noto Sans SC default", async () => {
    const { loadPreferences } = await loadStoreWithEntries([
      ["_version", 9],
      ["terminalFontFamily", "JetBrains Mono"],
      ["terminalCjkFontFamily", ""],
    ]);

    const prefs = await loadPreferences();

    expect(prefs.terminalCjkFontFamily).toBe("Noto Sans SC");
    expect(storeMock.set).toHaveBeenCalledWith(
      "terminalCjkFontFamily",
      "Noto Sans SC",
    );
  });

  it("keeps an explicitly chosen CJK font untouched", async () => {
    const { loadPreferences } = await loadStoreWithEntries([
      ["_version", 9],
      ["terminalCjkFontFamily", "LXGW WenKai"],
    ]);

    const prefs = await loadPreferences();

    expect(prefs.terminalCjkFontFamily).toBe("LXGW WenKai");
  });

  it("loads a separately stored CJK font without remigrating it", async () => {
    const { loadPreferences } = await loadStoreWithEntries([
      ["_version", 9],
      ["terminalFontFamily", "Fira Code"],
      ["terminalCjkFontFamily", "  SimSun  "],
    ]);

    const prefs = await loadPreferences();

    expect(prefs.terminalFontFamily).toBe("Fira Code");
    expect(prefs.terminalCjkFontFamily).toBe("SimSun");
  });

  it("removes retired editor preferences and shortcuts during migration", async () => {
    const { loadPreferences } = await loadStoreWithEntries([
      ["_version", 6],
      ["editorTheme", "tokyo-night"],
      ["vimMode", true],
      ["editorWordWrap", true],
      ["editorAutoSave", true],
      ["editorAutoSaveDelay", 1000],
      ["shortcuts", { "tab.newEditor": [{ ctrl: true, key: "e" }] }],
    ]);

    const prefs = await loadPreferences();

    expect("editorTheme" in prefs).toBe(false);
    expect("vimMode" in prefs).toBe(false);
    expect(storeMock.delete).toHaveBeenCalledWith("editorTheme");
    expect(storeMock.delete).toHaveBeenCalledWith("vimMode");
    expect(storeMock.delete).toHaveBeenCalledWith("editorWordWrap");
    expect(storeMock.delete).toHaveBeenCalledWith("editorAutoSave");
    expect(storeMock.delete).toHaveBeenCalledWith("editorAutoSaveDelay");
    expect(storeMock.set).toHaveBeenCalledWith("shortcuts", {});
    expect(storeMock.set).toHaveBeenCalledWith("_version", 10);
  });

  it("removes retired sidebar and explorer shortcuts during migration", async () => {
    const { loadPreferences } = await loadStoreWithEntries([
      ["_version", 7],
      [
        "shortcuts",
        {
          "sidebar.toggle": [{ ctrl: true, key: "b" }],
          "explorer.focus": [{ ctrl: true, shift: true, key: "e" }],
          "tab.new": [{ ctrl: true, key: "t" }],
        },
      ],
    ]);

    const prefs = await loadPreferences();

    expect(prefs.shortcuts).toEqual({ "tab.new": [{ ctrl: true, key: "t" }] });
    expect(storeMock.set).toHaveBeenCalledWith("shortcuts", {
      "tab.new": [{ ctrl: true, key: "t" }],
    });
    expect(storeMock.set).toHaveBeenCalledWith("_version", 10);
  });
});

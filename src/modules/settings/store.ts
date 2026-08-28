import { DEFAULT_MONO_FONT_FAMILY } from "@/lib/fonts";
import type { KeyBinding, ShortcutId } from "@/modules/shortcuts/shortcuts";
import { DEFAULT_THEME_ID, normalizeThemeId } from "@/modules/theme/types";
import {
  coerceTerminalCursorSmoothCaretAnimation,
  DEFAULT_TERMINAL_CURSOR_SMOOTH_CARET_ANIMATION,
  type TerminalCursorSmoothCaretAnimation,
} from "@/modules/terminal/lib/cursorMotion";
import {
  DEFAULT_TERMINAL_CURSOR_ANIMATION,
  DEFAULT_TERMINAL_CURSOR_SHAPE,
  DEFAULT_TERMINAL_CURSOR_WIDTH,
  type TerminalCursorAnimation,
  type TerminalCursorShape,
  type TerminalCursorWidth,
} from "@/modules/terminal/lib/cursorStyle";
import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";
import { LazyStore } from "@tauri-apps/plugin-store";

export type ThemePref = "system" | "light" | "dark";

export type Preferences = {
  theme: ThemePref;
  themeId: string;
  restoreWindowState: boolean;
  showHidden: boolean;
  terminalWebglEnabled: boolean;
  terminalCursorShape: TerminalCursorShape;
  terminalCursorAnimation: TerminalCursorAnimation;
  terminalCursorWidth: TerminalCursorWidth;
  terminalCursorSmoothCaretAnimation: TerminalCursorSmoothCaretAnimation;
  terminalFontFamily: string;
  terminalFontWeight: string;
  terminalShell: string;
  terminalLetterSpacing: number;
  terminalFontSize: number;
  terminalScrollback: number;
  lastWslDistro: string | null;
  zoomLevel: number;
  defaultWorkspaceEnv: string;
  shortcuts: Record<ShortcutId, KeyBinding[]>;
};

const STORE_PATH = "kite-settings.json";
const LEGACY_STORE_PATH = "terax-settings.json";
const KEY_THEME = "theme";
const KEY_THEME_ID = "themeId";
const KEY_RESTORE_WINDOW = "restoreWindowState";
const KEY_SHOW_HIDDEN = "showHidden";
const LEGACY_KEY_SHOW_HIDDEN_DIRS = "showHiddenDirectories";
const KEY_TERMINAL_WEBGL_ENABLED = "terminalWebglEnabled";
const KEY_TERMINAL_CURSOR_SMOOTH_CARET_ANIMATION =
  "terminalCursorSmoothCaretAnimation";
const KEY_TERMINAL_FONT_FAMILY = "terminalFontFamily";
const KEY_TERMINAL_FONT_WEIGHT = "terminalFontWeight";
const KEY_TERMINAL_SHELL = "terminalShell";
const KEY_TERMINAL_LETTER_SPACING = "terminalLetterSpacing";
const KEY_TERMINAL_FONT_SIZE = "terminalFontSize";
const KEY_TERMINAL_SCROLLBACK = "terminalScrollback";
const KEY_LAST_WSL_DISTRO = "lastWslDistro";
const KEY_ZOOM_LEVEL = "zoomLevel";
const KEY_DEFAULT_WORKSPACE_ENV = "defaultWorkspaceEnv";
const KEY_SHORTCUTS = "shortcuts";
const KEY_VERSION = "_version";
const REMOVED_BACKGROUND_KEYS = [
  "backgroundKind",
  "backgroundImageId",
  "backgroundOpacity",
  "backgroundBlur",
] as const;
const REMOVED_EXPLORER_KEYS = ["explorerGitDecorations"] as const;
const REMOVED_EDITOR_KEYS = [
  "editorTheme",
  "vimMode",
  "editorWordWrap",
  "editorAutoSave",
  "editorAutoSaveDelay",
] as const;
const REMOVED_SHORTCUT_IDS = [
  "search.focus",
  "tab.newEditor",
  "pane.source",
  "editor.undo",
  "editor.redo",
] as const;

export const TERMINAL_FONT_SIZE_DEFAULT = 14;
export const TERMINAL_FONT_SIZE_MIN = 8;
export const TERMINAL_FONT_SIZE_MAX = 32;

export const TERMINAL_FONT_SIZES = [
  10, 12, 13, 14, 15, 16, 18, 20, 22, 24,
] as const;

export const TERMINAL_SCROLLBACK_DEFAULT = 2000;
export const TERMINAL_SCROLLBACK_MIN = 200;
export const TERMINAL_SCROLLBACK_MAX = 50_000;
export const TERMINAL_SCROLLBACK_PRESETS = [
  500, 1000, 2000, 5000, 10_000, 25_000,
] as const;

export const DEFAULT_PREFERENCES: Preferences = {
  theme: "system",
  themeId: DEFAULT_THEME_ID,
  restoreWindowState: true,
  showHidden: false,
  terminalWebglEnabled: true,
  terminalCursorShape: DEFAULT_TERMINAL_CURSOR_SHAPE,
  terminalCursorAnimation: DEFAULT_TERMINAL_CURSOR_ANIMATION,
  terminalCursorWidth: DEFAULT_TERMINAL_CURSOR_WIDTH,
  terminalCursorSmoothCaretAnimation:
    DEFAULT_TERMINAL_CURSOR_SMOOTH_CARET_ANIMATION,
  terminalFontFamily: DEFAULT_MONO_FONT_FAMILY,
  terminalFontWeight: "normal",
  terminalShell: "",
  terminalLetterSpacing: 0,
  terminalFontSize: TERMINAL_FONT_SIZE_DEFAULT,
  terminalScrollback: TERMINAL_SCROLLBACK_DEFAULT,
  lastWslDistro: null,
  zoomLevel: 1.0,
  defaultWorkspaceEnv: "local",
  shortcuts: {} as Record<ShortcutId, KeyBinding[]>,
};

export function normalizeTerminalFontFamily(value: string | undefined): string {
  const fontFamily = value?.trim() ?? "";
  if (!fontFamily || fontFamily.toLowerCase() === "monaco") {
    return DEFAULT_MONO_FONT_FAMILY;
  }
  return fontFamily;
}

const store = new LazyStore(STORE_PATH, { defaults: {}, autoSave: 200 });
const legacyStore = new LazyStore(LEGACY_STORE_PATH, {
  defaults: {},
  autoSave: 200,
});

// ── Plan B: schema versioning ─────────────────────────────────────────────
// Bump SETTINGS_VERSION and add an entry to SETTINGS_MIGRATIONS when the
// Preferences schema changes (field rename, type change, etc.).
const SETTINGS_VERSION = 7;
const SETTINGS_MIGRATIONS: Record<number, (map: Map<string, unknown>) => void> =
  {
    2: (map) => {
      const themeId = map.get(KEY_THEME_ID);
      if (typeof themeId === "string") {
        map.set(KEY_THEME_ID, normalizeThemeId(themeId));
      }
    },
    3: (map) => {
      for (const key of REMOVED_BACKGROUND_KEYS) map.delete(key);
    },
    4: (map) => {
      for (const key of REMOVED_EXPLORER_KEYS) map.delete(key);
    },
    5: (map) => {
      removeRetiredShortcuts(map);
    },
    6: (map) => {
      const themeId = map.get(KEY_THEME_ID);
      if (typeof themeId === "string") {
        map.set(KEY_THEME_ID, normalizeThemeId(themeId));
      }
    },
    7: (map) => {
      for (const key of REMOVED_EDITOR_KEYS) map.delete(key);
      removeRetiredShortcuts(map);
    },
  };

function removeRetiredShortcuts(map: Map<string, unknown>): boolean {
  const shortcuts = map.get(KEY_SHORTCUTS);
  if (!shortcuts || typeof shortcuts !== "object" || Array.isArray(shortcuts)) {
    return false;
  }
  const next = { ...(shortcuts as Record<string, unknown>) };
  let removed = false;
  for (const id of REMOVED_SHORTCUT_IDS) {
    if (id in next) {
      delete next[id];
      removed = true;
    }
  }
  if (removed) map.set(KEY_SHORTCUTS, next);
  return removed;
}

// LazyStore.onChange only fires within the writing process. The settings
// page lives in a separate webview, so writes there never reach the main
// window's subscribers. Mirror every setter through a Tauri event so any
// window can listen.
const PREFS_CHANGED_EVENT = "kite://prefs-changed";

async function writePref<T>(key: string, value: T): Promise<void> {
  await store.set(key, value);
  await store.save();
  await emit(PREFS_CHANGED_EVENT, { key, value });
}

export async function loadPreferences(): Promise<Preferences> {
  // Single IPC roundtrip — fetching keys individually fans out to one
  // `plugin:store|get` per setting and is the dominant boot cost.
  let entries = await store.entries();
  let migratedFromLegacyStore = false;
  if (entries.length === 0) {
    entries = await legacyStore.entries();
    migratedFromLegacyStore = entries.length > 0;
  }
  const map = new Map<string, unknown>(entries);

  // ── Schema migration ────────────────────────────────────────────────────
  // Stores created before versioning was introduced are treated as version 1
  // so every later migration runs in order.
  const storedVersion = (map.get(KEY_VERSION) as number) ?? 1;
  let migrated = migratedFromLegacyStore || !map.has(KEY_VERSION);
  for (let v = storedVersion + 1; v <= SETTINGS_VERSION; v++) {
    SETTINGS_MIGRATIONS[v]?.(map);
    migrated = true;
  }
  for (const key of REMOVED_BACKGROUND_KEYS) {
    if (map.delete(key)) migrated = true;
  }
  for (const key of REMOVED_EXPLORER_KEYS) {
    if (map.delete(key)) migrated = true;
  }
  for (const key of REMOVED_EDITOR_KEYS) {
    if (map.delete(key)) migrated = true;
  }
  if (removeRetiredShortcuts(map)) migrated = true;
  if (migrated) {
    map.set(KEY_VERSION, SETTINGS_VERSION);
    for (const key of REMOVED_BACKGROUND_KEYS) {
      await store.delete(key);
    }
    for (const key of REMOVED_EXPLORER_KEYS) {
      await store.delete(key);
    }
    for (const key of REMOVED_EDITOR_KEYS) {
      await store.delete(key);
    }
    for (const [k, v] of map) {
      await store.set(k, v);
    }
    await store.save();
  }

  const get = <T>(k: string): T | undefined => map.get(k) as T | undefined;
  return {
    theme: get<ThemePref>(KEY_THEME) ?? DEFAULT_PREFERENCES.theme,
    themeId: normalizeThemeId(
      get<string>(KEY_THEME_ID) ?? DEFAULT_PREFERENCES.themeId,
    ),
    restoreWindowState:
      get<boolean>(KEY_RESTORE_WINDOW) ??
      DEFAULT_PREFERENCES.restoreWindowState,
    showHidden:
      get<boolean>(KEY_SHOW_HIDDEN) ??
      get<boolean>(LEGACY_KEY_SHOW_HIDDEN_DIRS) ??
      DEFAULT_PREFERENCES.showHidden,
    terminalWebglEnabled:
      get<boolean>(KEY_TERMINAL_WEBGL_ENABLED) ??
      DEFAULT_PREFERENCES.terminalWebglEnabled,
    terminalCursorShape: DEFAULT_PREFERENCES.terminalCursorShape,
    terminalCursorAnimation: DEFAULT_PREFERENCES.terminalCursorAnimation,
    terminalCursorWidth: DEFAULT_PREFERENCES.terminalCursorWidth,
    terminalCursorSmoothCaretAnimation:
      coerceTerminalCursorSmoothCaretAnimation(
        get<string>(KEY_TERMINAL_CURSOR_SMOOTH_CARET_ANIMATION),
      ),
    terminalFontFamily: normalizeTerminalFontFamily(
      get<string>(KEY_TERMINAL_FONT_FAMILY),
    ),
    terminalFontWeight: coerceFontWeight(
      get<string>(KEY_TERMINAL_FONT_WEIGHT) ??
        DEFAULT_PREFERENCES.terminalFontWeight,
    ),
    terminalShell:
      get<string>(KEY_TERMINAL_SHELL) ?? DEFAULT_PREFERENCES.terminalShell,
    terminalLetterSpacing:
      get<number>(KEY_TERMINAL_LETTER_SPACING) ??
      DEFAULT_PREFERENCES.terminalLetterSpacing,
    terminalFontSize:
      get<number>(KEY_TERMINAL_FONT_SIZE) ??
      DEFAULT_PREFERENCES.terminalFontSize,
    terminalScrollback: clampScrollback(
      get<number>(KEY_TERMINAL_SCROLLBACK) ??
        DEFAULT_PREFERENCES.terminalScrollback,
    ),
    lastWslDistro:
      get<string | null>(KEY_LAST_WSL_DISTRO) ??
      DEFAULT_PREFERENCES.lastWslDistro,
    zoomLevel: get<number>(KEY_ZOOM_LEVEL) ?? DEFAULT_PREFERENCES.zoomLevel,
    defaultWorkspaceEnv:
      get<string>(KEY_DEFAULT_WORKSPACE_ENV) ??
      DEFAULT_PREFERENCES.defaultWorkspaceEnv,
    shortcuts:
      get<Record<ShortcutId, KeyBinding[]>>(KEY_SHORTCUTS) ??
      DEFAULT_PREFERENCES.shortcuts,
  };
}

export async function setTheme(value: ThemePref): Promise<void> {
  await writePref(KEY_THEME, value);
}

export async function setThemeId(value: string): Promise<void> {
  await writePref(KEY_THEME_ID, normalizeThemeId(value));
}

export async function setShowHidden(value: boolean): Promise<void> {
  await writePref(KEY_SHOW_HIDDEN, value);
}

export async function setTerminalWebglEnabled(value: boolean): Promise<void> {
  await writePref(KEY_TERMINAL_WEBGL_ENABLED, value);
}

export async function setTerminalCursorSmoothCaretAnimation(
  value: TerminalCursorSmoothCaretAnimation,
): Promise<void> {
  await writePref(
    KEY_TERMINAL_CURSOR_SMOOTH_CARET_ANIMATION,
    coerceTerminalCursorSmoothCaretAnimation(value),
  );
}

export async function setTerminalFontFamily(value: string): Promise<void> {
  await writePref(KEY_TERMINAL_FONT_FAMILY, normalizeTerminalFontFamily(value));
}

const TERMINAL_FONT_WEIGHT_VALUES = new Set(["normal", "500", "600", "bold"]);

export function coerceFontWeight(value: string): string {
  const v = value.trim();
  return TERMINAL_FONT_WEIGHT_VALUES.has(v) ? v : "normal";
}

export async function setTerminalFontWeight(value: string): Promise<void> {
  await writePref(KEY_TERMINAL_FONT_WEIGHT, coerceFontWeight(value));
}

export async function setTerminalShell(value: string): Promise<void> {
  await writePref(KEY_TERMINAL_SHELL, value.trim());
}

export async function setTerminalLetterSpacing(value: number): Promise<void> {
  const clamped = Number.isFinite(value)
    ? Math.max(-10, Math.min(10, Math.round(value)))
    : 0;
  await writePref(KEY_TERMINAL_LETTER_SPACING, clamped);
}

export async function setTerminalFontSize(value: number): Promise<void> {
  const clamped = Number.isFinite(value)
    ? Math.min(
        TERMINAL_FONT_SIZE_MAX,
        Math.max(TERMINAL_FONT_SIZE_MIN, Math.round(value)),
      )
    : TERMINAL_FONT_SIZE_DEFAULT;
  await writePref(KEY_TERMINAL_FONT_SIZE, clamped);
}

function clampScrollback(value: number): number {
  if (!Number.isFinite(value)) return TERMINAL_SCROLLBACK_DEFAULT;
  return Math.min(
    TERMINAL_SCROLLBACK_MAX,
    Math.max(TERMINAL_SCROLLBACK_MIN, Math.round(value)),
  );
}

export async function setTerminalScrollback(value: number): Promise<void> {
  await writePref(KEY_TERMINAL_SCROLLBACK, clampScrollback(value));
}

export async function setLastWslDistro(value: string | null): Promise<void> {
  await writePref(KEY_LAST_WSL_DISTRO, value);
}

export async function setZoomLevel(value: number): Promise<void> {
  await writePref(KEY_ZOOM_LEVEL, value);
}

export async function setRestoreWindowState(value: boolean): Promise<void> {
  await writePref(KEY_RESTORE_WINDOW, value);
}

export async function setDefaultWorkspaceEnv(value: string): Promise<void> {
  await writePref(KEY_DEFAULT_WORKSPACE_ENV, value);
}

export async function setShortcuts(
  value: Partial<Record<ShortcutId, KeyBinding[]>>,
): Promise<void> {
  await writePref(KEY_SHORTCUTS, value);
}

export async function resetShortcuts(): Promise<void> {
  await writePref(KEY_SHORTCUTS, DEFAULT_PREFERENCES.shortcuts);
}

export type PrefKey = keyof Preferences;

/** Subscribe to changes from any window (settings → main). */
export async function onPreferencesChange(
  cb: (key: PrefKey, value: unknown) => void,
): Promise<UnlistenFn> {
  const map: Record<string, PrefKey> = {
    [KEY_THEME]: "theme",
    [KEY_THEME_ID]: "themeId",
    [KEY_RESTORE_WINDOW]: "restoreWindowState",
    [KEY_SHOW_HIDDEN]: "showHidden",
    [KEY_TERMINAL_WEBGL_ENABLED]: "terminalWebglEnabled",
    [KEY_TERMINAL_CURSOR_SMOOTH_CARET_ANIMATION]:
      "terminalCursorSmoothCaretAnimation",
    [KEY_TERMINAL_FONT_FAMILY]: "terminalFontFamily",
    [KEY_TERMINAL_FONT_WEIGHT]: "terminalFontWeight",
    [KEY_TERMINAL_SHELL]: "terminalShell",
    [KEY_TERMINAL_LETTER_SPACING]: "terminalLetterSpacing",
    [KEY_TERMINAL_FONT_SIZE]: "terminalFontSize",
    [KEY_TERMINAL_SCROLLBACK]: "terminalScrollback",
    [KEY_LAST_WSL_DISTRO]: "lastWslDistro",
    [KEY_ZOOM_LEVEL]: "zoomLevel",
    [KEY_DEFAULT_WORKSPACE_ENV]: "defaultWorkspaceEnv",
    [KEY_SHORTCUTS]: "shortcuts",
  };
  // Same-process writes still fire onChange immediately; cross-window writes
  // arrive via the Tauri event emitted by writePref().
  const unsubLocal = await store.onChange<unknown>((key, value) => {
    const mapped = map[key];
    if (mapped) cb(mapped, value);
  });
  const unsubEvent = await listen<{ key: string; value: unknown }>(
    PREFS_CHANGED_EVENT,
    (e) => {
      const mapped = map[e.payload.key];
      if (mapped) cb(mapped, e.payload.value);
    },
  );
  return () => {
    unsubLocal();
    unsubEvent();
  };
}

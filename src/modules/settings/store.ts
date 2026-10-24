import {
  DEFAULT_CJK_FONT_FAMILY,
  DEFAULT_MONO_FONT_FAMILY,
  splitLegacyFontFamily,
} from "@/lib/fonts";
import type { KeyBinding, ShortcutId } from "@/modules/shortcuts/shortcuts";
import { DEFAULT_THEME_ID, normalizeThemeId } from "@/modules/theme/types";
import {
  coerceTerminalCursorSmoothCaretAnimation,
  DEFAULT_TERMINAL_CURSOR_SMOOTH_CARET_ANIMATION,
  type TerminalCursorSmoothCaretAnimation,
} from "@/modules/terminal/lib/cursorMotion";
import {
  coerceTerminalCursorAnimation,
  DEFAULT_TERMINAL_CURSOR_ANIMATION,
  DEFAULT_TERMINAL_CURSOR_SHAPE,
  DEFAULT_TERMINAL_CURSOR_WIDTH,
  type TerminalCursorAnimation,
  type TerminalCursorShape,
  type TerminalCursorWidth,
} from "@/modules/terminal/lib/cursorStyle";
import type { TerminalLinkActivation } from "@/modules/terminal/lib/linkPolicy";
import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";
import { LazyStore } from "@tauri-apps/plugin-store";

export type ThemePref = "system" | "light" | "dark";

export type Preferences = {
  theme: ThemePref;
  themeId: string;
  restoreWindowState: boolean;
  terminalWebglEnabled: boolean;
  terminalLinkActivation: TerminalLinkActivation;
  terminalCopyOnSelect: boolean;
  terminalRightClickPaste: boolean;
  terminalTrimCopyWhitespace: boolean;
  terminalPasteGuard: boolean;
  terminalBellNotify: boolean;
  terminalCommandNotify: boolean;
  terminalCursorShape: TerminalCursorShape;
  terminalCursorAnimation: TerminalCursorAnimation;
  terminalCursorWidth: TerminalCursorWidth;
  terminalCursorSmoothCaretAnimation: TerminalCursorSmoothCaretAnimation;
  terminalFontFamily: string;
  terminalCjkFontFamily: string;
  terminalFontWeight: string;
  terminalShell: string;
  terminalLetterSpacing: number;
  terminalFontSize: number;
  terminalScrollback: number;
  zoomLevel: number;
  sessionRestore: boolean;
  quakeEnabled: boolean;
  shortcuts: Record<ShortcutId, KeyBinding[]>;
};

const STORE_PATH = "kite-settings.json";
const LEGACY_STORE_PATH = "terax-settings.json";
const KEY_THEME = "theme";
const KEY_THEME_ID = "themeId";
const KEY_RESTORE_WINDOW = "restoreWindowState";
const KEY_TERMINAL_WEBGL_ENABLED = "terminalWebglEnabled";
const KEY_TERMINAL_LINK_ACTIVATION = "terminalLinkActivation";
const KEY_TERMINAL_COPY_ON_SELECT = "terminalCopyOnSelect";
const KEY_TERMINAL_RIGHT_CLICK_PASTE = "terminalRightClickPaste";
const KEY_TERMINAL_TRIM_COPY_WHITESPACE = "terminalTrimCopyWhitespace";
const KEY_TERMINAL_PASTE_GUARD = "terminalPasteGuard";
const KEY_TERMINAL_BELL_NOTIFY = "terminalBellNotify";
const KEY_TERMINAL_COMMAND_NOTIFY = "terminalCommandNotify";
const KEY_TERMINAL_CURSOR_ANIMATION = "terminalCursorAnimation";
const KEY_TERMINAL_CURSOR_SMOOTH_CARET_ANIMATION =
  "terminalCursorSmoothCaretAnimation";
const KEY_TERMINAL_FONT_FAMILY = "terminalFontFamily";
const KEY_TERMINAL_CJK_FONT_FAMILY = "terminalCjkFontFamily";
const KEY_TERMINAL_FONT_WEIGHT = "terminalFontWeight";
const KEY_TERMINAL_SHELL = "terminalShell";
const KEY_TERMINAL_LETTER_SPACING = "terminalLetterSpacing";
const KEY_TERMINAL_FONT_SIZE = "terminalFontSize";
const KEY_TERMINAL_SCROLLBACK = "terminalScrollback";
const KEY_ZOOM_LEVEL = "zoomLevel";
const KEY_SESSION_RESTORE = "sessionRestore";
const KEY_QUAKE_ENABLED = "quakeEnabled";
/** Layout-only session snapshot; owned by the main window, never synced. */
const KEY_SESSION_LAYOUT = "sessionLayout";
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
const REMOVED_WORKSPACE_KEYS = [
  "showHidden",
  "showHiddenDirectories",
  "lastWslDistro",
  "defaultWorkspaceEnv",
] as const;
const REMOVED_SHORTCUT_IDS = [
  "search.focus",
  "tab.newEditor",
  "pane.source",
  "editor.undo",
  "editor.redo",
  "sidebar.toggle",
  "explorer.focus",
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

const LINK_ACTIVATION_VALUES: readonly TerminalLinkActivation[] = [
  "ctrlClick",
  "direct",
];

export function coerceTerminalLinkActivation(
  value: unknown,
): TerminalLinkActivation {
  return typeof value === "string" &&
    (LINK_ACTIVATION_VALUES as readonly string[]).includes(value)
    ? (value as TerminalLinkActivation)
    : "ctrlClick";
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: "system",
  themeId: DEFAULT_THEME_ID,
  restoreWindowState: true,
  terminalWebglEnabled: true,
  terminalLinkActivation: "ctrlClick",
  terminalCopyOnSelect: false,
  terminalRightClickPaste: false,
  terminalTrimCopyWhitespace: false,
  terminalPasteGuard: true,
  terminalBellNotify: false,
  terminalCommandNotify: false,
  terminalCursorShape: DEFAULT_TERMINAL_CURSOR_SHAPE,
  terminalCursorAnimation: DEFAULT_TERMINAL_CURSOR_ANIMATION,
  terminalCursorWidth: DEFAULT_TERMINAL_CURSOR_WIDTH,
  terminalCursorSmoothCaretAnimation:
    DEFAULT_TERMINAL_CURSOR_SMOOTH_CARET_ANIMATION,
  terminalFontFamily: DEFAULT_MONO_FONT_FAMILY,
  terminalCjkFontFamily: DEFAULT_CJK_FONT_FAMILY,
  terminalFontWeight: "normal",
  terminalShell: "",
  terminalLetterSpacing: 0,
  terminalFontSize: TERMINAL_FONT_SIZE_DEFAULT,
  terminalScrollback: TERMINAL_SCROLLBACK_DEFAULT,
  zoomLevel: 1.0,
  sessionRestore: false,
  quakeEnabled: false,
  shortcuts: {} as Record<ShortcutId, KeyBinding[]>,
};

// Only whitespace is stripped, and an empty value falls back to the bundled
// default. "Monaco" is deliberately NOT treated as a retired sentinel here: it
// was the pre-v1 default, but it is also a real installed family, and this
// function runs on every user commit. That rewrite belongs to migration 9, which
// sees the legacy value once.
export function normalizeTerminalFontFamily(value: string | undefined): string {
  const fontFamily = value?.trim() ?? "";
  if (!fontFamily) return DEFAULT_MONO_FONT_FAMILY;
  return fontFamily;
}

// Unlike the code font, an explicit empty value is meaningful here: it is the
// "自动" (automatic) choice, so only surrounding whitespace is stripped. Stores
// written before the Noto Sans SC default are filled in once by migration 10.
export function normalizeTerminalCjkFontFamily(
  value: string | undefined,
): string {
  return value?.trim() ?? "";
}

const store = new LazyStore(STORE_PATH, { defaults: {}, autoSave: 200 });
const legacyStore = new LazyStore(LEGACY_STORE_PATH, {
  defaults: {},
  autoSave: 200,
});

// ── Plan B: schema versioning ─────────────────────────────────────────────
// Bump SETTINGS_VERSION and add an entry to SETTINGS_MIGRATIONS when the
// Preferences schema changes (field rename, type change, etc.). Entries 3-8
// were removed: their work (key deletion, retired shortcuts) is done
// unconditionally on every load below, so migrating those versions is a
// no-op beyond bumping KEY_VERSION. Theme id migrations stay: they rewrite
// the stored schema, not just its interpretation. Former entry 11 (rewriting
// stored "JetBrains Mono"/"Noto Sans SC" to the bundled family names) is
// gone on purpose: a store holding those strings is indistinguishable from
// a user who deliberately picked them, and the resolver's fallback chain
// already renders an uninstalled upstream family through the bundled face.
const SETTINGS_VERSION = 11;
const SETTINGS_MIGRATIONS: Record<number, (map: Map<string, unknown>) => void> =
  {
    2: (map) => {
      const themeId = map.get(KEY_THEME_ID);
      if (typeof themeId === "string") {
        map.set(KEY_THEME_ID, normalizeThemeId(themeId));
      }
    },
    6: (map) => {
      const themeId = map.get(KEY_THEME_ID);
      if (typeof themeId === "string") {
        map.set(KEY_THEME_ID, normalizeThemeId(themeId));
      }
    },
    9: (map) => {
      if (map.has(KEY_TERMINAL_CJK_FONT_FAMILY)) return;
      const legacy = map.get(KEY_TERMINAL_FONT_FAMILY);
      const { codeFontFamily, cjkFontFamily } = splitLegacyFontFamily(
        typeof legacy === "string" ? legacy : undefined,
      );
      map.set(KEY_TERMINAL_FONT_FAMILY, codeFontFamily);
      map.set(KEY_TERMINAL_CJK_FONT_FAMILY, cjkFontFamily);
    },
    10: (map) => {
      // Adopt Noto Sans SC as the shipped default. Stores written while the
      // default was the empty "自动" sentinel hold "", which `??`-style reads
      // keep forever, so they must be filled in explicitly.
      const cjk = map.get(KEY_TERMINAL_CJK_FONT_FAMILY);
      if (cjk === undefined || (typeof cjk === "string" && cjk.trim() === "")) {
        map.set(KEY_TERMINAL_CJK_FONT_FAMILY, DEFAULT_CJK_FONT_FAMILY);
      }
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
  try {
    await store.set(key, value);
    await store.save();
  } catch (error) {
    // Setters are called with `void`, so a swallowed persistence failure
    // reads as "the setting reverted by itself" in the settings window.
    // Log loudly instead; the emit is skipped because nothing was written.
    console.error(`writePref ${key} failed:`, error);
    return;
  }
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
  for (const key of REMOVED_WORKSPACE_KEYS) {
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
    for (const key of REMOVED_WORKSPACE_KEYS) {
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
    terminalWebglEnabled:
      get<boolean>(KEY_TERMINAL_WEBGL_ENABLED) ??
      DEFAULT_PREFERENCES.terminalWebglEnabled,
    terminalLinkActivation: coerceTerminalLinkActivation(
      get<unknown>(KEY_TERMINAL_LINK_ACTIVATION),
    ),
    terminalCopyOnSelect:
      get<boolean>(KEY_TERMINAL_COPY_ON_SELECT) ??
      DEFAULT_PREFERENCES.terminalCopyOnSelect,
    terminalRightClickPaste:
      get<boolean>(KEY_TERMINAL_RIGHT_CLICK_PASTE) ??
      DEFAULT_PREFERENCES.terminalRightClickPaste,
    terminalTrimCopyWhitespace:
      get<boolean>(KEY_TERMINAL_TRIM_COPY_WHITESPACE) ??
      DEFAULT_PREFERENCES.terminalTrimCopyWhitespace,
    terminalPasteGuard:
      get<boolean>(KEY_TERMINAL_PASTE_GUARD) ??
      DEFAULT_PREFERENCES.terminalPasteGuard,
    terminalBellNotify:
      get<boolean>(KEY_TERMINAL_BELL_NOTIFY) ??
      DEFAULT_PREFERENCES.terminalBellNotify,
    terminalCommandNotify:
      get<boolean>(KEY_TERMINAL_COMMAND_NOTIFY) ??
      DEFAULT_PREFERENCES.terminalCommandNotify,
    terminalCursorShape: DEFAULT_PREFERENCES.terminalCursorShape,
    terminalCursorAnimation: coerceTerminalCursorAnimation(
      get<unknown>(KEY_TERMINAL_CURSOR_ANIMATION),
    ),
    terminalCursorWidth: DEFAULT_PREFERENCES.terminalCursorWidth,
    terminalCursorSmoothCaretAnimation:
      coerceTerminalCursorSmoothCaretAnimation(
        get<string>(KEY_TERMINAL_CURSOR_SMOOTH_CARET_ANIMATION),
      ),
    terminalFontFamily: normalizeTerminalFontFamily(
      get<string>(KEY_TERMINAL_FONT_FAMILY),
    ),
    terminalCjkFontFamily: normalizeTerminalCjkFontFamily(
      get<string>(KEY_TERMINAL_CJK_FONT_FAMILY),
    ),
    terminalFontWeight: coerceFontWeight(
      get<string>(KEY_TERMINAL_FONT_WEIGHT) ??
        DEFAULT_PREFERENCES.terminalFontWeight,
    ),
    terminalShell:
      get<string>(KEY_TERMINAL_SHELL) ?? DEFAULT_PREFERENCES.terminalShell,
    terminalLetterSpacing: clampLetterSpacing(
      get<number>(KEY_TERMINAL_LETTER_SPACING) ??
        DEFAULT_PREFERENCES.terminalLetterSpacing,
    ),
    terminalFontSize: clampTerminalFontSize(
      get<number>(KEY_TERMINAL_FONT_SIZE) ??
        DEFAULT_PREFERENCES.terminalFontSize,
    ),
    terminalScrollback: clampScrollback(
      get<number>(KEY_TERMINAL_SCROLLBACK) ??
        DEFAULT_PREFERENCES.terminalScrollback,
    ),
    zoomLevel: clampZoomLevel(
      get<number>(KEY_ZOOM_LEVEL) ?? DEFAULT_PREFERENCES.zoomLevel,
    ),
    sessionRestore:
      get<boolean>(KEY_SESSION_RESTORE) ??
      DEFAULT_PREFERENCES.sessionRestore,
    quakeEnabled:
      get<boolean>(KEY_QUAKE_ENABLED) ?? DEFAULT_PREFERENCES.quakeEnabled,
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

export async function setTerminalWebglEnabled(value: boolean): Promise<void> {
  await writePref(KEY_TERMINAL_WEBGL_ENABLED, value);
}

export async function setTerminalLinkActivation(
  value: TerminalLinkActivation,
): Promise<void> {
  await writePref(KEY_TERMINAL_LINK_ACTIVATION, coerceTerminalLinkActivation(value));
}

export async function setTerminalCopyOnSelect(value: boolean): Promise<void> {
  await writePref(KEY_TERMINAL_COPY_ON_SELECT, value);
}

export async function setTerminalRightClickPaste(
  value: boolean,
): Promise<void> {
  await writePref(KEY_TERMINAL_RIGHT_CLICK_PASTE, value);
}

export async function setTerminalTrimCopyWhitespace(
  value: boolean,
): Promise<void> {
  await writePref(KEY_TERMINAL_TRIM_COPY_WHITESPACE, value);
}

export async function setTerminalPasteGuard(value: boolean): Promise<void> {
  await writePref(KEY_TERMINAL_PASTE_GUARD, value);
}

export async function setTerminalBellNotify(value: boolean): Promise<void> {
  await writePref(KEY_TERMINAL_BELL_NOTIFY, value);
}

export async function setTerminalCommandNotify(value: boolean): Promise<void> {
  await writePref(KEY_TERMINAL_COMMAND_NOTIFY, value);
}

export async function setTerminalCursorAnimation(
  value: TerminalCursorAnimation,
): Promise<void> {
  await writePref(
    KEY_TERMINAL_CURSOR_ANIMATION,
    coerceTerminalCursorAnimation(value),
  );
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

export async function setTerminalCjkFontFamily(value: string): Promise<void> {
  await writePref(
    KEY_TERMINAL_CJK_FONT_FAMILY,
    normalizeTerminalCjkFontFamily(value),
  );
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
  await writePref(KEY_TERMINAL_LETTER_SPACING, clampLetterSpacing(value));
}

function clampLetterSpacing(value: number): number {
  return Number.isFinite(value)
    ? Math.max(-10, Math.min(10, Math.round(value)))
    : 0;
}

export async function setTerminalFontSize(value: number): Promise<void> {
  await writePref(KEY_TERMINAL_FONT_SIZE, clampTerminalFontSize(value));
}

function clampTerminalFontSize(value: number): number {
  return Number.isFinite(value)
    ? Math.min(
        TERMINAL_FONT_SIZE_MAX,
        Math.max(TERMINAL_FONT_SIZE_MIN, Math.round(value)),
      )
    : TERMINAL_FONT_SIZE_DEFAULT;
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

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 2;

function clampZoomLevel(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_PREFERENCES.zoomLevel;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value * 100) / 100));
}

export async function setZoomLevel(value: number): Promise<void> {
  await writePref(KEY_ZOOM_LEVEL, clampZoomLevel(value));
}

export async function setRestoreWindowState(value: boolean): Promise<void> {
  await writePref(KEY_RESTORE_WINDOW, value);
}

export async function setSessionRestore(value: boolean): Promise<void> {
  await writePref(KEY_SESSION_RESTORE, value);
}

export async function setQuakeEnabled(value: boolean): Promise<void> {
  await writePref(KEY_QUAKE_ENABLED, value);
}

/** Layout-only snapshot: stored directly, no cross-window change event. */
export async function saveSessionLayout(layout: unknown): Promise<void> {
  await store.set(KEY_SESSION_LAYOUT, layout);
  await store.save();
}

export async function loadSessionLayout(): Promise<unknown> {
  return (await store.get<unknown>(KEY_SESSION_LAYOUT)) ?? null;
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
    [KEY_TERMINAL_WEBGL_ENABLED]: "terminalWebglEnabled",
    [KEY_TERMINAL_LINK_ACTIVATION]: "terminalLinkActivation",
    [KEY_TERMINAL_COPY_ON_SELECT]: "terminalCopyOnSelect",
    [KEY_TERMINAL_RIGHT_CLICK_PASTE]: "terminalRightClickPaste",
    [KEY_TERMINAL_TRIM_COPY_WHITESPACE]: "terminalTrimCopyWhitespace",
    [KEY_TERMINAL_PASTE_GUARD]: "terminalPasteGuard",
    [KEY_TERMINAL_BELL_NOTIFY]: "terminalBellNotify",
    [KEY_TERMINAL_COMMAND_NOTIFY]: "terminalCommandNotify",
    [KEY_TERMINAL_CURSOR_ANIMATION]: "terminalCursorAnimation",
    [KEY_TERMINAL_CURSOR_SMOOTH_CARET_ANIMATION]:
      "terminalCursorSmoothCaretAnimation",
    [KEY_TERMINAL_FONT_FAMILY]: "terminalFontFamily",
    [KEY_TERMINAL_CJK_FONT_FAMILY]: "terminalCjkFontFamily",
    [KEY_TERMINAL_FONT_WEIGHT]: "terminalFontWeight",
    [KEY_TERMINAL_SHELL]: "terminalShell",
    [KEY_TERMINAL_LETTER_SPACING]: "terminalLetterSpacing",
    [KEY_TERMINAL_FONT_SIZE]: "terminalFontSize",
    [KEY_TERMINAL_SCROLLBACK]: "terminalScrollback",
    [KEY_ZOOM_LEVEL]: "zoomLevel",
    [KEY_SESSION_RESTORE]: "sessionRestore",
    [KEY_QUAKE_ENABLED]: "quakeEnabled",
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

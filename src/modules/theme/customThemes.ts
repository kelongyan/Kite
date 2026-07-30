import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";
import { LazyStore } from "@tauri-apps/plugin-store";
import type { Theme } from "./types";

const STORE_PATH = "kite-custom-themes.json";
const LEGACY_STORE_PATH = "terax-custom-themes.json";
const KEY = "themes";
const CHANGED_EVENT = "kite://custom-themes-changed";

const store = new LazyStore(STORE_PATH, { defaults: {}, autoSave: 200 });
const legacyStore = new LazyStore(LEGACY_STORE_PATH, {
  defaults: {},
  autoSave: 200,
});

export async function listCustomThemes(): Promise<Theme[]> {
  const v = await store.get<Theme[]>(KEY);
  if (Array.isArray(v)) return v;
  const legacy = await legacyStore.get<Theme[]>(KEY);
  if (!Array.isArray(legacy)) return [];
  await store.set(KEY, legacy);
  await store.save();
  return legacy;
}

export async function saveCustomTheme(theme: Theme): Promise<void> {
  const current = await listCustomThemes();
  const next = current.filter((t) => t.id !== theme.id).concat(theme);
  await store.set(KEY, next);
  await store.save();
  await emit(CHANGED_EVENT);
}

export async function deleteCustomTheme(id: string): Promise<void> {
  const current = await listCustomThemes();
  const next = current.filter((t) => t.id !== id);
  if (next.length === current.length) return;
  await store.set(KEY, next);
  await store.save();
  await emit(CHANGED_EVENT);
}

export async function onCustomThemesChange(cb: () => void): Promise<UnlistenFn> {
  const unsubLocal = await store.onChange((key) => {
    if (key === KEY) cb();
  });
  const unsubEvent = await listen(CHANGED_EVENT, () => cb());
  return () => {
    unsubLocal();
    unsubEvent();
  };
}

import { LazyStore } from "@tauri-apps/plugin-store";
import type { WorkspaceEnv } from "@/modules/workspace";
import type { SerializedTab } from "./serialize";

export type SpaceMeta = {
  id: string;
  name: string;
  root: string | null;
  env: WorkspaceEnv;
  /** Opt-in accent, index into SPACE_COLORS. Undefined = theme primary. */
  color?: number;
  createdAt: number;
  updatedAt: number;
};

export type SpaceState = {
  tabs: SerializedTab[];
  activeTabIndex: number;
};

const STORE_PATH = "terax-spaces.json";
const KEY_SPACES = "spaces";
const KEY_ACTIVE = "activeId";
const STATE_PREFIX = "state:";
const KEY_VERSION = "_version";
const stateKey = (id: string) => `${STATE_PREFIX}${id}`;

const store = new LazyStore(STORE_PATH, { defaults: {}, autoSave: 500 });

// ── Schema versioning ────────────────────────────────────────────────────
// Bump SPACES_VERSION and add an entry to SPACES_MIGRATIONS when SpaceMeta
// or SpaceState structure changes.
const SPACES_VERSION = 1;
const SPACES_MIGRATIONS: Record<
  number,
  (map: Map<string, unknown>) => void
> = {
  // reserved
};

export type LoadedSpaces = {
  spaces: SpaceMeta[];
  activeId: string | null;
  states: Map<string, SpaceState>;
};

export async function loadAll(): Promise<LoadedSpaces> {
  const entries = await store.entries();
  const map = new Map<string, unknown>(entries);

  // ── Schema migration ─────────────────────────────────────────────────────
  const storedVersion = (map.get(KEY_VERSION) as number) ?? 1;
  let migrated = !map.has(KEY_VERSION);
  for (let v = storedVersion + 1; v <= SPACES_VERSION; v++) {
    SPACES_MIGRATIONS[v]?.(map);
    migrated = true;
  }
  if (migrated) {
    map.set(KEY_VERSION, SPACES_VERSION);
    for (const [k, v] of map) {
      await store.set(k, v);
    }
    await store.save();
  }

  let spaces: SpaceMeta[] = [];
  let activeId: string | null = null;
  const states = new Map<string, SpaceState>();
  for (const [k, v] of map) {
    if (k === KEY_SPACES) spaces = (v as SpaceMeta[]) ?? [];
    else if (k === KEY_ACTIVE) activeId = (v as string | null) ?? null;
    else if (k.startsWith(STATE_PREFIX)) {
      states.set(k.slice(STATE_PREFIX.length), v as SpaceState);
    }
  }
  return { spaces, activeId, states };
}

export async function saveSpacesList(spaces: SpaceMeta[]): Promise<void> {
  await store.set(KEY_SPACES, spaces);
}

export async function saveActiveId(id: string | null): Promise<void> {
  await store.set(KEY_ACTIVE, id);
}

export async function saveState(id: string, state: SpaceState): Promise<void> {
  await store.set(stateKey(id), state);
}

export async function deleteSpaceData(id: string): Promise<void> {
  await store.delete(stateKey(id));
}

export function newSpaceId(): string {
  return `sp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

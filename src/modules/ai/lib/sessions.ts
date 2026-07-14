import type { UIMessage } from "@ai-sdk/react";
import { LazyStore } from "@tauri-apps/plugin-store";

export type SessionMeta = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
};

// ── Plan A: per-session message files ────────────────────────────────────────
// Messages are stored in individual files (terax-ai-msg-{id}.json) instead of
// all in terax-ai-sessions.json. This eliminates write-amplification: saving
// one session's messages no longer rewrites everyone else's messages.
const STORE_PATH = "terax-ai-sessions.json";
const KEY_SESSIONS = "sessions";
const KEY_ACTIVE = "activeId";
const KEY_MSG_IDS = "msgFileIds"; // tracks known per-session files for orphan cleanup
const KEY_VERSION = "_version"; // Plan B: schema version

// ── Plan B: schema versioning ─────────────────────────────────────────────
// Bump SESSIONS_VERSION and add an entry to MIGRATIONS when the schema changes.
const SESSIONS_VERSION = 1;
const MIGRATIONS: Record<number, (map: Map<string, unknown>) => void> = {
  // reserved — example: 2: (m) => { m.set("newKey", m.get("oldKey")); m.delete("oldKey"); }
};

// ── Plan C: session count limit ───────────────────────────────────────────
// Oldest sessions (by updatedAt) are removed when the total exceeds this value.
const MAX_SESSIONS = 200;

const MESSAGES_KEY = "messages"; // key within each per-session file

const store = new LazyStore(STORE_PATH, { defaults: {}, autoSave: 200 });

// Per-session message stores, created on demand and cached for reuse.
const msgStoreCache = new Map<string, LazyStore>();
function getMsgStore(id: string): LazyStore {
  let s = msgStoreCache.get(id);
  if (!s) {
    s = new LazyStore(`terax-ai-msg-${id}.json`, { defaults: {}, autoSave: 200 });
    msgStoreCache.set(id, s);
  }
  return s;
}

export type LoadedSessions = {
  sessions: SessionMeta[];
  activeId: string | null;
};

export async function loadAll(): Promise<LoadedSessions> {
  // One IPC roundtrip via entries() rather than multiple get()s.
  const entries = await store.entries();
  const map = new Map<string, unknown>(entries);

  // ── Plan B: run pending migrations ────────────────────────────────────
  // Stores created before versioning was introduced are treated as version 1
  // (the baseline) so no migrations run on existing data.
  const storedVersion = (map.get(KEY_VERSION) as number) ?? 1;
  let needsSave = !map.has(KEY_VERSION);
  for (let v = storedVersion + 1; v <= SESSIONS_VERSION; v++) {
    MIGRATIONS[v]?.(map);
    needsSave = true;
  }

  // ── Plan A: migrate old messages:* keys to separate files ─────────────
  // Any messages:* entries still in terax-ai-sessions.json are from the
  // pre-split era; move them to individual files on first boot after upgrade.
  const legacyMsgKeys = [...map.keys()].filter((k) => k.startsWith("messages:"));
  if (legacyMsgKeys.length > 0) {
    const migratedIds: string[] = [];
    await Promise.all(
      legacyMsgKeys.map(async (k) => {
        const id = k.slice("messages:".length);
        const msgs = map.get(k) as UIMessage[] | undefined;
        if (msgs) {
          const ms = getMsgStore(id);
          await ms.set(MESSAGES_KEY, msgs);
          await ms.save();
          migratedIds.push(id);
        }
        map.delete(k);
        await store.delete(k);
      }),
    );
    // Register migrated IDs in the msgFileIds registry
    const existingIds = (map.get(KEY_MSG_IDS) as string[]) ?? [];
    map.set(KEY_MSG_IDS, [...new Set([...existingIds, ...migratedIds])]);
    needsSave = true;
  }

  if (needsSave) {
    map.set(KEY_VERSION, SESSIONS_VERSION);
    for (const [k, v] of map) {
      // Guard: skip any stray legacy keys that slipped through
      if (!k.startsWith("messages:")) await store.set(k, v);
    }
    await store.save();
  }

  let sessions = (map.get(KEY_SESSIONS) as SessionMeta[]) ?? [];
  const activeId = (map.get(KEY_ACTIVE) as string | null) ?? null;
  let msgIds = new Set((map.get(KEY_MSG_IDS) as string[]) ?? []);
  const sessionIds = new Set(sessions.map((s) => s.id));

  // ── Plan C: orphan cleanup ─────────────────────────────────────────────
  // Any ID in msgFileIds that has no matching entry in the sessions list is a
  // leftover from a crashed or incomplete delete — remove it now.
  const orphans = [...msgIds].filter((id) => !sessionIds.has(id));
  if (orphans.length > 0) {
    await Promise.all(
      orphans.map(async (id) => {
        try {
          const ms = getMsgStore(id);
          await ms.clear();
          await ms.save();
          msgStoreCache.delete(id);
        } catch {
          /* best-effort; file may already be gone */
        }
      }),
    );
    msgIds = new Set([...msgIds].filter((id) => sessionIds.has(id)));
    await store.set(KEY_MSG_IDS, [...msgIds]);
    await store.save();
  }

  // ── Plan C: session count limit ────────────────────────────────────────
  // When the session list grows beyond MAX_SESSIONS, trim the oldest entries
  // (lowest updatedAt) and delete their message files.
  if (sessions.length > MAX_SESSIONS) {
    const sorted = [...sessions].sort((a, b) => a.updatedAt - b.updatedAt);
    const toTrim = sorted.slice(0, sessions.length - MAX_SESSIONS);
    await Promise.all(
      toTrim.map(async (s) => {
        try {
          const ms = getMsgStore(s.id);
          await ms.clear();
          await ms.save();
          msgStoreCache.delete(s.id);
        } catch {
          /* best-effort */
        }
        msgIds.delete(s.id);
      }),
    );
    const trimIds = new Set(toTrim.map((s) => s.id));
    sessions = sessions.filter((s) => !trimIds.has(s.id));
    await store.set(KEY_SESSIONS, sessions);
    await store.set(KEY_MSG_IDS, [...msgIds]);
    await store.save();
  }

  return { sessions, activeId };
}

export async function loadMessages(id: string): Promise<UIMessage[] | null> {
  // Plan A: load from per-session file (not from the shared sessions store).
  // Per-session messages are loaded lazily only when a session is opened,
  // so cold boot stays at a single store call regardless of history length.
  return (await getMsgStore(id).get<UIMessage[]>(MESSAGES_KEY)) ?? null;
}

export async function saveSessionsList(sessions: SessionMeta[]): Promise<void> {
  await store.set(KEY_SESSIONS, sessions);
}

export async function saveActiveId(id: string | null): Promise<void> {
  await store.set(KEY_ACTIVE, id);
}

export async function saveMessages(
  id: string,
  messages: UIMessage[],
): Promise<void> {
  // Plan A: write only to the per-session file — zero impact on other sessions.
  await getMsgStore(id).set(MESSAGES_KEY, messages);

  // Ensure this session's ID is registered in the msgFileIds registry so it
  // can be cleaned up if the session is later deleted.
  const existing = (await store.get<string[]>(KEY_MSG_IDS)) ?? [];
  if (!existing.includes(id)) {
    await store.set(KEY_MSG_IDS, [...existing, id]);
  }
}

export async function deleteSessionData(id: string): Promise<void> {
  // Plan A: clear the per-session message file.
  try {
    const ms = getMsgStore(id);
    await ms.clear();
    await ms.save();
    msgStoreCache.delete(id);
  } catch {
    /* best-effort; file may never have been written */
  }
  // Remove from the msgFileIds registry.
  const existing = (await store.get<string[]>(KEY_MSG_IDS)) ?? [];
  await store.set(KEY_MSG_IDS, existing.filter((i) => i !== id));
}

export function newSessionId(): string {
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function deriveTitle(messages: UIMessage[]): string {
  for (const m of messages) {
    if (m.role !== "user") continue;
    for (const p of m.parts) {
      if (p.type !== "text") continue;
      const text = (p as { text: string }).text
        .replace(/<terminal-context[\s\S]*?<\/terminal-context>\s*/g, "")
        .replace(/<selection[\s\S]*?<\/selection>\s*/g, "")
        .replace(/<file[\s\S]*?<\/file>\s*/g, "")
        .trim();
      if (!text) continue;
      const first = text.split("\n")[0].trim();
      return first.length > 40 ? `${first.slice(0, 40)}…` : first;
    }
  }
  return "New chat";
}

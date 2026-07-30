const DB_NAME = "kite-bg-images";
const LEGACY_DB_NAME = "terax-bg-images";
const STORE = "images";
const VERSION = 1;

const dbPromises = new Map<string, Promise<IDBDatabase>>();

function openDb(name = DB_NAME): Promise<IDBDatabase> {
  const existing = dbPromises.get(name);
  if (existing) return existing;
  const p = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(name, VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onclose = () => {
        if (dbPromises.get(name) === p) dbPromises.delete(name);
      };
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("IndexedDB blocked by another tab"));
  }).catch((e) => {
    if (dbPromises.get(name) === p) dbPromises.delete(name);
    throw e;
  });
  dbPromises.set(name, p);
  return p;
}

async function readBgImage(db: IDBDatabase, id: string): Promise<Blob | null> {
  return new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function legacyDbExists(): Promise<boolean> {
  if (!indexedDB.databases) return true;
  const databases = await indexedDB.databases();
  return databases.some((db) => db.name === LEGACY_DB_NAME);
}

async function putBgImage(id: string, blob: Blob): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(blob, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "QuotaExceededError") {
      throw new Error(
        "Not enough storage to save this image. Remove unused themes or backgrounds and try again.",
      );
    }
    throw e;
  }
}

export async function getBgImage(id: string): Promise<Blob | null> {
  const db = await openDb();
  const current = await readBgImage(db, id);
  if (current) return current;
  if (!(await legacyDbExists())) return null;
  const legacy = await readBgImage(await openDb(LEGACY_DB_NAME), id);
  if (legacy) await putBgImage(id, legacy);
  return legacy;
}

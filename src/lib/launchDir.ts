import { invoke } from "@tauri-apps/api/core";

let cached: string | undefined;

/**
 * A secondary window receives its cwd in the URL query (`index.html?cwd=...`).
 * It wins over the process-wide launch dir, which the backend drains on first
 * read anyway.
 */
function cwdFromUrlQuery(): string | undefined {
  if (typeof location === "undefined") return undefined;
  const raw = new URLSearchParams(location.search).get("cwd");
  if (!raw) return undefined;
  try {
    return decodeURIComponent(raw).replace(/\\/g, "/");
  } catch {
    return raw.replace(/\\/g, "/");
  }
}

export async function initLaunchDir(): Promise<void> {
  const fromQuery = cwdFromUrlQuery();
  if (fromQuery) {
    cached = fromQuery;
    return;
  }
  const dir = await invoke<string | null>("get_launch_dir").catch(() => null);
  cached = dir ? dir.replace(/\\/g, "/") : undefined;
}

export function getLaunchDir(): string | undefined {
  return cached;
}

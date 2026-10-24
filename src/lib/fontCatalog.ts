import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

export type FontFamilyInfo = {
  family: string;
  monospace: boolean;
  cjk: boolean;
};

let cache: FontFamilyInfo[] | null = null;
let inflight: Promise<FontFamilyInfo[]> | null = null;

function fetchFontCatalog(): Promise<FontFamilyInfo[]> {
  if (cache) return Promise.resolve(cache);
  inflight ??= invoke<FontFamilyInfo[]>("list_fonts")
    .catch(() => [] as FontFamilyInfo[])
    .then((list) => {
      cache = list;
      return list;
    });
  return inflight;
}

/** Suggestions for a free-text font field, optionally filtered by kind. */
export function fontSuggestions(
  catalog: FontFamilyInfo[],
  kind: "code" | "cjk",
  limit = 400,
): string[] {
  const preferred =
    kind === "code"
      ? catalog.filter((f) => f.monospace)
      : catalog.filter((f) => f.cjk);
  const pool = preferred.length > 0 ? preferred : catalog;
  return pool.slice(0, limit).map((f) => f.family);
}

/**
 * System font families from the `list_fonts` command. Cached module-wide:
 * refreshes are pointless while the window is open (installs are rare) and
 * the picker should not pay the enumeration cost twice.
 */
export function useFontCatalog(): FontFamilyInfo[] {
  const [catalog, setCatalog] = useState<FontFamilyInfo[]>(cache ?? []);
  useEffect(() => {
    if (cache) return;
    let cancelled = false;
    void fetchFontCatalog().then((list) => {
      if (!cancelled) setCatalog(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return catalog;
}

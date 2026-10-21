import { useCallback, useEffect, useState } from "react";
import { homeDir } from "@tauri-apps/api/path";
import { getLaunchDir } from "@/lib/launchDir";

type Params = {
  resetWorkspace: (home?: string) => void;
  /** Dispose live sessions and clear App-owned pane/handle ref maps. */
  clearWorkspaceState: () => void;
};

/** Owns the resolved home and launch cwd for the local shell. */
export function useHomeLocation({
  resetWorkspace,
  clearWorkspaceState,
}: Params) {
  const [home, setHome] = useState<string | null>(null);
  const [homeResolved, setHomeResolved] = useState(false);
  const [launchCwd, setLaunchCwd] = useState<string | null>(
    () => getLaunchDir() ?? null,
  );

  useEffect(() => {
    homeDir()
      .then((p) => setHome(p.replace(/\\/g, "/")))
      .catch(() => setHome(null))
      .finally(() => setHomeResolved(true));
  }, []);

  const openLaunchDir = useCallback(
    (dir: string): boolean => {
      if (dir.length === 0) {
        return false;
      }
      const normalized = dir.replace(/\\/g, "/");
      clearWorkspaceState();
      setLaunchCwd(normalized);
      resetWorkspace(normalized);
      return true;
    },
    [clearWorkspaceState, resetWorkspace],
  );

  return { home, homeResolved, launchCwd, openLaunchDir };
}

import { useCallback, useEffect, useState } from "react";
import { homeDir } from "@tauri-apps/api/path";
import { getLaunchDir } from "@/lib/launchDir";
import { native } from "@/lib/native";
import {
  getWslHome,
  LOCAL_WORKSPACE,
  type WorkspaceEnv,
} from "@/modules/workspace";

async function resolveEnvHome(env: WorkspaceEnv): Promise<string> {
  return env.kind === "wsl"
    ? getWslHome(env.distro)
    : (await homeDir()).replace(/\\/g, "/");
}

type Params = {
  workspaceEnv: WorkspaceEnv;
  setWorkspaceEnv: (env: WorkspaceEnv) => void;
  resetWorkspace: (home?: string) => void;
  /** Dispose live sessions and clear App-owned pane/handle ref maps. */
  clearWorkspaceState: () => void;
};

/** Owns the resolved home and launch cwd for Local and WSL workspaces. */
export function useWorkspaceSwitcher({
  workspaceEnv,
  setWorkspaceEnv,
  resetWorkspace,
  clearWorkspaceState,
}: Params) {
  const [home, setHome] = useState<string | null>(null);
  const [homeResolved, setHomeResolved] = useState(false);
  const [launchCwd, setLaunchCwd] = useState<string | null>(
    () => getLaunchDir() ?? null,
  );
  const launchCwdResolved = true;

  useEffect(() => {
    homeDir()
      .then(async (p) => {
        const normalized = p.replace(/\\/g, "/");
        setHome(normalized);
        try {
          await native.workspaceAuthorize(normalized);
        } catch {
          // Bootstrap already authorizes home from Rust; ignore.
        }
      })
      .catch(() => setHome(null))
      .finally(() => setHomeResolved(true));
  }, []);

  const authorizeHome = useCallback(async (nextHome: string) => {
    setHome(nextHome);
    setLaunchCwd(nextHome);
    try {
      await native.workspaceAuthorize(nextHome);
    } catch {
      // Non-fatal — restricted surfaces will show "not authorized" if needed.
    }
  }, []);

  const authorizeHomeOnly = useCallback(async (nextHome: string) => {
    setHome(nextHome);
    try {
      await native.workspaceAuthorize(nextHome);
    } catch {
      // Non-fatal — restricted surfaces will show "not authorized" if needed.
    }
  }, []);

  const openLocalWorkspace = useCallback(
    async (dir: string): Promise<boolean> => {
      if (dir.length === 0) {
        return false;
      }

      const normalized = dir.replace(/\\/g, "/");
      let nextHome: string;
      try {
        nextHome = await resolveEnvHome(LOCAL_WORKSPACE);
      } catch (e) {
        window.alert(String(e));
        return false;
      }

      clearWorkspaceState();
      setWorkspaceEnv(LOCAL_WORKSPACE);
      await authorizeHomeOnly(nextHome);
      setLaunchCwd(normalized);
      try {
        await native.workspaceAuthorize(normalized);
      } catch {
        // Rust already validated Explorer-launched directories; keep opening.
      }
      resetWorkspace(normalized);
      return true;
    },
    [
      clearWorkspaceState,
      setWorkspaceEnv,
      authorizeHomeOnly,
      resetWorkspace,
    ],
  );

  const switchWorkspace = useCallback(
    async (env: WorkspaceEnv): Promise<boolean> => {
      if (
        env.kind === workspaceEnv.kind &&
        (env.kind === "local" ||
          (workspaceEnv.kind === "wsl" && env.distro === workspaceEnv.distro))
      ) {
        return false;
      }

      let nextHome: string;
      try {
        nextHome = await resolveEnvHome(env);
      } catch (e) {
        window.alert(String(e));
        return false;
      }

      clearWorkspaceState();
      setWorkspaceEnv(env.kind === "local" ? LOCAL_WORKSPACE : env);
      await authorizeHome(nextHome);
      resetWorkspace(nextHome);
      return true;
    },
    [
      workspaceEnv,
      setWorkspaceEnv,
      resetWorkspace,
      clearWorkspaceState,
      authorizeHome,
    ],
  );

  return {
    home,
    homeResolved,
    launchCwd,
    launchCwdResolved,
    switchWorkspace,
    openLocalWorkspace,
  };
}

import { type RefObject, useCallback, useEffect, useState } from "react";
import { homeDir } from "@tauri-apps/api/path";
import { getLaunchDir } from "@/lib/launchDir";
import { native } from "@/lib/native";
import { useMessages } from "@/modules/i18n";
import type { Tab } from "@/modules/tabs";
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
  tabsRef: RefObject<Tab[]>;
  workspaceEnv: WorkspaceEnv;
  setWorkspaceEnv: (env: WorkspaceEnv) => void;
  resetWorkspace: (home?: string) => void;
  /** Dispose live sessions and clear App-owned pane/handle ref maps. */
  clearWorkspaceState: () => void;
};

/** Owns the resolved home and launch cwd for Local and WSL workspaces. */
export function useWorkspaceSwitcher({
  tabsRef,
  workspaceEnv,
  setWorkspaceEnv,
  resetWorkspace,
  clearWorkspaceState,
}: Params) {
  const messages = useMessages().mainShell.workspaceSwitcher;
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
      // Non-fatal — git panel will surface "not authorized" if needed.
    }
  }, []);

  const authorizeHomeOnly = useCallback(async (nextHome: string) => {
    setHome(nextHome);
    try {
      await native.workspaceAuthorize(nextHome);
    } catch {
      // Non-fatal — git panel will surface "not authorized" if needed.
    }
  }, []);

  const openLocalWorkspace = useCallback(
    async (dir: string): Promise<boolean> => {
      if (dir.length === 0) {
        return false;
      }

      const dirty = tabsRef.current.some((t) => t.kind === "editor" && t.dirty);
      if (dirty) {
        window.alert(messages.saveOrCloseUnsavedEditors);
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
      tabsRef,
      messages.saveOrCloseUnsavedEditors,
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
      const dirty = tabsRef.current.some((t) => t.kind === "editor" && t.dirty);
      if (dirty) {
        window.alert(messages.saveOrCloseUnsavedEditors);
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
      tabsRef,
      clearWorkspaceState,
      authorizeHome,
      messages.saveOrCloseUnsavedEditors,
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

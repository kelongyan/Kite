import { invoke } from "@tauri-apps/api/core";

export type ShellChoice = {
  name: string;
  /** Executable path, or `wsl:<distro>` for WSL distributions. */
  path: string;
  /** True when Kite injects OSC 7/133 shell integration. */
  integrated: boolean;
};

let shellsPromise: Promise<ShellChoice[]> | null = null;

/**
 * Enumerated shells (backend `pty_list_shells`), cached per window: the
 * list backs both the tab-bar "new tab" dropdown and the palette sub-page.
 */
export function listTerminalShells(): Promise<ShellChoice[]> {
  if (!shellsPromise) {
    shellsPromise = invoke<ShellChoice[]>("pty_list_shells").catch((e) => {
      shellsPromise = null;
      console.error("[kite] pty_list_shells failed:", e);
      return [];
    });
  }
  return shellsPromise;
}

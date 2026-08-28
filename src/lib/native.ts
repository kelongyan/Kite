import { invoke } from "@tauri-apps/api/core";

export const native = {
  async workspaceAuthorize(dir: string): Promise<void> {
    await invoke("workspace_authorize", { path: dir });
  },
};

import { invoke } from "@tauri-apps/api/core";
import type { WorkspaceEnv } from "@/modules/workspace";

// ─── Types ──────────────────────────────────────────────────────────────────

export type GitRepoInfo = {
  repoRoot: string;
  branch: string;
  upstream: string | null;
  isDetached: boolean;
};

export type GitChangedFile = {
  path: string;
  originalPath: string | null;
  indexStatus: string;
  worktreeStatus: string;
  staged: boolean;
  unstaged: boolean;
  untracked: boolean;
  statusLabel: string;
};

export type GitStatusSnapshot = {
  repoRoot: string;
  branch: string;
  upstream: string | null;
  ahead: number;
  behind: number;
  isDetached: boolean;
  truncated: boolean;
  changedFiles: GitChangedFile[];
};

export type GitPanelSnapshot = {
  repo: GitRepoInfo | null;
  status: GitStatusSnapshot | null;
};

export type GitDiscardEntry = { path: string; untracked: boolean };

export type GitDiffContentResult = {
  originalContent: string;
  modifiedContent: string;
  isBinary: boolean;
  fallbackPatch: string;
  truncated: boolean;
};

export type GitCommitResult = { commitSha: string; summary: string };

export type GitCommitFileChange = {
  path: string;
  originalPath: string | null;
  status: string;
  statusLabel: string;
  added: number;
  removed: number;
  isBinary: boolean;
};

export type GitLogEntry = {
  sha: string;
  shortSha: string;
  author: string;
  authorEmail: string;
  timestampSecs: number;
  parents: string[];
  subject: string;
  filesChanged: number;
  insertions: number;
  deletions: number;
};

export type GitPushResult = {
  remote: string | null;
  branch: string | null;
  pushed: boolean;
};

export type GitBranchEntry = {
  name: string;
  kind: string;
  worktreePath: string | null;
  isHead: boolean;
  isDetached: boolean;
};

export type GitBranchListResult = { branches: GitBranchEntry[] };

// ─── Native object ──────────────────────────────────────────────────────────

export const native = {
  async workspaceAuthorize(dir: string): Promise<void> {
    await invoke("workspace_authorize", { dir }).catch(() => {});
  },

  async gitResolveRepo(
    cwd: string,
    workspace?: WorkspaceEnv,
  ): Promise<GitRepoInfo | null> {
    return invoke<GitRepoInfo | null>("git_resolve_repo", { cwd, workspace });
  },

  async gitPanelSnapshot(
    cwd: string,
    workspace?: WorkspaceEnv,
  ): Promise<GitPanelSnapshot> {
    return invoke<GitPanelSnapshot>("git_panel_snapshot", { cwd, workspace });
  },

  async gitStatus(
    repoRoot: string,
    workspace?: WorkspaceEnv,
  ): Promise<GitStatusSnapshot> {
    return invoke<GitStatusSnapshot>("git_status", { repoRoot, workspace });
  },

  async gitDiffContent(
    repoRoot: string,
    path: string,
    staged: boolean,
    originalPath?: string | null,
    workspace?: WorkspaceEnv,
  ): Promise<GitDiffContentResult> {
    return invoke<GitDiffContentResult>("git_diff_content", {
      repoRoot,
      path,
      staged,
      originalPath,
      workspace,
    });
  },

  async gitStage(repoRoot: string, paths: string[], workspace?: WorkspaceEnv): Promise<void> {
    await invoke("git_stage", { repoRoot, paths, workspace });
  },

  async gitUnstage(repoRoot: string, paths: string[], workspace?: WorkspaceEnv): Promise<void> {
    await invoke("git_unstage", { repoRoot, paths, workspace });
  },

  async gitDiscard(
    repoRoot: string,
    entries: GitDiscardEntry[],
    workspace?: WorkspaceEnv,
  ): Promise<void> {
    await invoke("git_discard", { repoRoot, entries, workspace });
  },

  async gitCommit(
    repoRoot: string,
    message: string,
    workspace?: WorkspaceEnv,
  ): Promise<GitCommitResult> {
    return invoke<GitCommitResult>("git_commit", { repoRoot, message, workspace });
  },

  async gitFetch(repoRoot: string, workspace?: WorkspaceEnv): Promise<void> {
    await invoke("git_fetch", { repoRoot, workspace });
  },

  async gitPullFfOnly(repoRoot: string, workspace?: WorkspaceEnv): Promise<void> {
    await invoke("git_pull_ff_only", { repoRoot, workspace });
  },

  async canonicalize(path: string): Promise<string> {
    return invoke<string>("fs_canonicalize", { path });
  },

  async gitPush(repoRoot: string, workspace?: WorkspaceEnv): Promise<GitPushResult> {
    return invoke<GitPushResult>("git_push", { repoRoot, workspace });
  },

  async gitLog(
    repoRoot: string,
    limit?: number,
    beforeSha?: string,
    workspace?: WorkspaceEnv,
  ): Promise<GitLogEntry[]> {
    return invoke<GitLogEntry[]>("git_log", { repoRoot, limit, beforeSha, workspace });
  },

  async gitCommitFiles(
    repoRoot: string,
    sha: string,
    workspace?: WorkspaceEnv,
  ): Promise<GitCommitFileChange[]> {
    return invoke<GitCommitFileChange[]>("git_commit_files", { repoRoot, sha, workspace });
  },

  async gitCommitFileDiff(
    repoRoot: string,
    sha: string,
    path: string,
    originalPath?: string | null,
    workspace?: WorkspaceEnv,
  ): Promise<GitDiffContentResult> {
    return invoke<GitDiffContentResult>("git_commit_file_diff", {
      repoRoot,
      sha,
      path,
      originalPath,
      workspace,
    });
  },

  async gitRemoteUrl(
    repoRoot: string,
    name?: string,
    workspace?: WorkspaceEnv,
  ): Promise<string | null> {
    return invoke<string | null>("git_remote_url", { repoRoot, name, workspace });
  },

  async gitListBranches(
    repoRoot: string,
    workspace?: WorkspaceEnv,
  ): Promise<GitBranchListResult> {
    return invoke<GitBranchListResult>("git_list_branches", { repoRoot, workspace });
  },

  async gitCheckoutBranch(
    repoRoot: string,
    branch: string,
    workspace?: WorkspaceEnv,
  ): Promise<void> {
    await invoke("git_checkout_branch", { repoRoot, branch, workspace });
  },
};

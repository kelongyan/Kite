import { invoke } from "@tauri-apps/api/core";
import { currentWorkspaceEnv } from "@/modules/workspace";
import type {
  SftpConnectResult,
  SftpBatchTransferResult,
  SftpConflictPolicy,
  SftpEntry,
  SftpProfile,
  SftpProfileTemplate,
  SftpProfileSaveRequest,
} from "./types";

export type LocalDirEntry = {
  name: string;
  kind: "file" | "dir" | "symlink";
  size: number;
  mtime: number;
  gitignored: boolean;
};

export const sftpApi = {
  profiles: () => invoke<SftpProfile[]>("sftp_profile_list"),
  sshConfigTemplates: () =>
    invoke<SftpProfileTemplate[]>("sftp_ssh_config_templates"),
  saveProfile: (input: SftpProfileSaveRequest) =>
    invoke<SftpProfile>("sftp_profile_save", { input }),
  deleteProfile: (profileId: string) =>
    invoke<void>("sftp_profile_delete", { profileId }),
  connect: (profileId: string, acceptHostKey = false) =>
    invoke<SftpConnectResult>("sftp_connect", {
      profileId,
      acceptHostKey,
    }),
  disconnect: (connectionId: string) =>
    invoke<void>("sftp_disconnect", { connectionId }),
  readRemoteDir: (connectionId: string, path: string) =>
    invoke<SftpEntry[]>("sftp_read_dir", { connectionId, path }),
  searchRemote: (
    connectionId: string,
    path: string,
    query: string,
    limit = 200,
  ) => invoke<SftpEntry[]>("sftp_search", { connectionId, path, query, limit }),
  createRemoteDir: (connectionId: string, path: string) =>
    invoke<void>("sftp_create_dir", { connectionId, path }),
  renameRemote: (
    connectionId: string,
    sourcePath: string,
    targetPath: string,
  ) =>
    invoke<void>("sftp_rename", {
      connectionId,
      sourcePath,
      targetPath,
    }),
  deleteRemote: (connectionId: string, paths: string[]) =>
    invoke<void>("sftp_delete", { connectionId, paths }),
  readLocalDir: (path: string) =>
    invoke<LocalDirEntry[]>("fs_read_dir", {
      path,
      showHidden: true,
      gitDecorations: false,
      workspace: currentWorkspaceEnv(),
    }),
  uploadFile: (connectionId: string, localPath: string, remotePath: string) =>
    invoke<string>("sftp_upload_file", {
      connectionId,
      localPath,
      remotePath,
      workspace: currentWorkspaceEnv(),
    }),
  downloadFile: (connectionId: string, remotePath: string, localPath: string) =>
    invoke<string>("sftp_download_file", {
      connectionId,
      remotePath,
      localPath,
      workspace: currentWorkspaceEnv(),
    }),
  uploadEntries: (
    connectionId: string,
    localPaths: string[],
    remoteDir: string,
    conflictPolicy: SftpConflictPolicy,
  ) =>
    invoke<SftpBatchTransferResult>("sftp_upload_entries", {
      input: {
        connectionId,
        localPaths,
        remoteDir,
        conflictPolicy,
        workspace: currentWorkspaceEnv(),
      },
    }),
  downloadEntries: (
    connectionId: string,
    remotePaths: string[],
    localDir: string,
    conflictPolicy: SftpConflictPolicy,
  ) =>
    invoke<SftpBatchTransferResult>("sftp_download_entries", {
      input: {
        connectionId,
        remotePaths,
        localDir,
        conflictPolicy,
        workspace: currentWorkspaceEnv(),
      },
    }),
  cancelTransfer: (transferId: string) =>
    invoke<void>("sftp_cancel_transfer", { transferId }),
};

export type SftpAuthMethod = "password" | "privateKey";

export type SftpProfile = {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: SftpAuthMethod;
  privateKeyPath?: string | null;
  defaultRemotePath: string;
  trustedHostKey?: string | null;
};

export type SftpProfileSaveRequest = Omit<SftpProfile, "id"> & {
  id?: string | null;
  password?: string | null;
  passphrase?: string | null;
};

export type SftpProfileTemplate = {
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: SftpAuthMethod;
  privateKeyPath?: string | null;
  defaultRemotePath: string;
};

export type SftpConnectResult =
  | {
      status: "connected";
      connectionId: string;
      profile: SftpProfile;
      fingerprint: string;
    }
  | {
      status: "hostKeyRequired";
      profileId: string;
      host: string;
      port: number;
      fingerprint: string;
      previousFingerprint?: string | null;
      changed: boolean;
    };

export type SftpEntry = {
  name: string;
  path: string;
  kind: "file" | "dir" | "symlink" | "other";
  size: number;
  mtime: number;
  permissions?: string | null;
};

export type LocalEntry = {
  name: string;
  path: string;
  kind: "file" | "dir" | "symlink";
  size: number;
  mtime: number;
};

export type SftpConflictPolicy = "skip" | "overwrite" | "rename";

export type SftpBatchIssue = {
  source: string;
  target: string;
  error: string;
};

export type SftpBatchTransferResult = {
  transferIds: string[];
  skipped: SftpBatchIssue[];
  errors: SftpBatchIssue[];
};

export type SftpTransfer = {
  id: string;
  connectionId: string;
  direction: "upload" | "download";
  source: string;
  target: string;
  bytesDone: number;
  bytesTotal: number;
  status: "queued" | "running" | "done" | "failed" | "canceled";
  error?: string | null;
};

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useMessages } from "@/modules/i18n";
import { sftpApi } from "@/modules/sftp/lib/api";
import {
  dirname,
  joinLocalPath,
  joinRemotePath,
} from "@/modules/sftp/lib/path";
import { buildSyncPlan, type SyncPlan } from "@/modules/sftp/lib/diffEntries";
import {
  detectNameConflicts,
  nextSelection,
  selectedEntries,
  type SelectMode,
} from "@/modules/sftp/lib/selection";
import type {
  LocalEntry,
  SftpEntry,
  SftpConflictPolicy,
  SftpTransfer,
} from "@/modules/sftp/lib/types";
import { useSftpStore } from "@/modules/sftp/store/sftpStore";
import type { Tab } from "@/modules/tabs";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { Plug01Icon, ServerStack01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import {
  conflictDecisionReducer,
  initialConflictDecisionState,
} from "@/modules/sftp/lib/conflict";
import { ConflictDialog } from "@/modules/sftp/components/ConflictDialog";
import { SftpConnectionDialog } from "@/modules/sftp/components/SftpConnectionDialog";
import { SftpFilePane } from "@/modules/sftp/components/SftpFilePane";
import { SyncPreview } from "@/modules/sftp/components/SyncPreview";
import { TransferQueue } from "@/modules/sftp/components/TransferQueue";

type Props = {
  tabs: Tab[];
  activeId: number;
};

type PaneState<T> = {
  entries: T[];
  selectedPaths: Set<string>;
  anchorPath: string | null;
  loading: boolean;
  error: string | null;
};

type PendingTransfer =
  | { direction: "upload"; entries: LocalEntry[] }
  | { direction: "download"; entries: SftpEntry[] };

export function SftpTransferStack({ tabs, activeId }: Props) {
  const sftpTabs = tabs.filter((tab) => tab.kind === "sftp");
  const setProfiles = useSftpStore((state) => state.setProfiles);
  const upsertTransfer = useSftpStore((state) => state.upsertTransfer);

  useEffect(() => {
    void sftpApi
      .profiles()
      .then(setProfiles)
      .catch(() => {});
    let active = true;
    let unlisten: (() => void) | undefined;
    void listen<SftpTransfer>("sftp:transfer", (event) => {
      upsertTransfer(event.payload);
    }).then((fn) => {
      if (!active) {
        fn();
        return;
      }
      unlisten = fn;
    });
    return () => {
      active = false;
      unlisten?.();
    };
  }, [setProfiles, upsertTransfer]);

  return (
    <>
      {sftpTabs.map((tab) => (
        <div
          key={tab.id}
          className={cn("h-full min-h-0", tab.id !== activeId && "hidden")}
        >
          <SftpTransferPane initialLocalPath={tab.localPath} />
        </div>
      ))}
    </>
  );
}

function SftpTransferPane({ initialLocalPath }: { initialLocalPath?: string }) {
  const profiles = useSftpStore((state) => state.profiles);
  const connection = useSftpStore((state) => state.connection);
  const transfers = useSftpStore((state) => state.transfers);
  const setProfiles = useSftpStore((state) => state.setProfiles);
  const setConnection = useSftpStore((state) => state.setConnection);
  const clearCompleted = useSftpStore((state) => state.clearCompleted);
  const messages = useMessages().workspace.sftp;

  const [connectOpen, setConnectOpen] = useState(false);
  const [localPath, setLocalPath] = useState(initialLocalPath ?? "");
  const [remotePath, setRemotePath] = useState("/");
  const [local, setLocal] = useState<PaneState<LocalEntry>>({
    entries: [],
    selectedPaths: new Set(),
    anchorPath: null,
    loading: false,
    error: null,
  });
  const [remote, setRemote] = useState<PaneState<SftpEntry>>({
    entries: [],
    selectedPaths: new Set(),
    anchorPath: null,
    loading: false,
    error: null,
  });
  const [remoteSearch, setRemoteSearch] = useState<{
    query: string;
    count: number;
  } | null>(null);
  const [syncPlan, setSyncPlan] = useState<SyncPlan | null>(null);
  const [conflictState, dispatchConflict] = useReducer(
    conflictDecisionReducer,
    initialConflictDecisionState,
  );
  const [pendingTransfer, setPendingTransfer] =
    useState<PendingTransfer | null>(null);

  useEffect(() => {
    if (initialLocalPath || localPath) return;
    void invoke<string>("workspace_current_dir")
      .then(setLocalPath)
      .catch(() => {});
  }, [initialLocalPath, localPath]);

  const loadLocal = useCallback(async () => {
    if (!localPath) return;
    setLocal((state) => ({ ...state, loading: true, error: null }));
    try {
      const entries = await sftpApi.readLocalDir(localPath);
      setLocal({
        entries: entries.map((entry) => ({
          name: entry.name,
          path: joinLocalPath(localPath, entry.name),
          kind: entry.kind,
          size: entry.size,
          mtime: entry.mtime,
        })),
        selectedPaths: new Set(),
        anchorPath: null,
        loading: false,
        error: null,
      });
    } catch (err) {
      setLocal((state) => ({
        ...state,
        loading: false,
        error: String(err),
      }));
    }
  }, [localPath]);

  const loadRemote = useCallback(async () => {
    if (!connection) return;
    setRemote((state) => ({ ...state, loading: true, error: null }));
    try {
      const entries = await sftpApi.readRemoteDir(connection.id, remotePath);
      setRemote({
        entries,
        selectedPaths: new Set(),
        anchorPath: null,
        loading: false,
        error: null,
      });
      setRemoteSearch(null);
    } catch (err) {
      setRemote((state) => ({
        ...state,
        loading: false,
        error: String(err),
      }));
    }
  }, [connection, remotePath]);

  useEffect(() => {
    void loadLocal();
  }, [loadLocal]);

  useEffect(() => {
    if (connection) void loadRemote();
  }, [connection, loadRemote]);

  const localSelected = useMemo(
    () => selectedEntries(local.entries, local.selectedPaths),
    [local.entries, local.selectedPaths],
  );
  const remoteSelected = useMemo(
    () => selectedEntries(remote.entries, remote.selectedPaths),
    [remote.entries, remote.selectedPaths],
  );
  const canUpload = Boolean(connection && localSelected.length > 0);
  const canDownload = Boolean(connection && remoteSelected.length > 0);
  const canPreviewSync = Boolean(
    connection && !local.loading && !remote.loading && !remoteSearch,
  );

  const updateLocalSelection = (
    entry: LocalEntry | SftpEntry,
    mode: SelectMode,
    visiblePaths: string[],
  ) => {
    setLocal((state) => ({
      ...state,
      selectedPaths: nextSelection(
        state.selectedPaths,
        entry.path,
        mode,
        visiblePaths,
        state.anchorPath,
      ),
      anchorPath:
        mode === "range" ? (state.anchorPath ?? entry.path) : entry.path,
    }));
  };

  const updateRemoteSelection = (
    entry: LocalEntry | SftpEntry,
    mode: SelectMode,
    visiblePaths: string[],
  ) => {
    setRemote((state) => ({
      ...state,
      selectedPaths: nextSelection(
        state.selectedPaths,
        entry.path,
        mode,
        visiblePaths,
        state.anchorPath,
      ),
      anchorPath:
        mode === "range" ? (state.anchorPath ?? entry.path) : entry.path,
    }));
  };

  const uploadSelected = async (
    policy: SftpConflictPolicy = "skip",
    skipConflictCheck = false,
  ) => {
    if (!connection || localSelected.length === 0) return;
    if (!skipConflictCheck) {
      const conflicts = detectNameConflicts(
        localSelected,
        new Set(remote.entries.map((entry) => entry.name)),
      );
      if (conflicts.length > 0) {
        setPendingTransfer({ direction: "upload", entries: localSelected });
        dispatchConflict({ type: "open", conflicts });
        return;
      }
    }
    await sftpApi.uploadEntries(
      connection.id,
      localSelected.map((entry) => entry.path),
      remotePath,
      policy,
    );
  };

  const downloadSelected = async (
    policy: SftpConflictPolicy = "skip",
    skipConflictCheck = false,
  ) => {
    if (!connection || remoteSelected.length === 0) return;
    if (!skipConflictCheck) {
      const conflicts = detectNameConflicts(
        remoteSelected,
        new Set(local.entries.map((entry) => entry.name)),
      );
      if (conflicts.length > 0) {
        setPendingTransfer({ direction: "download", entries: remoteSelected });
        dispatchConflict({ type: "open", conflicts });
        return;
      }
    }
    await sftpApi.downloadEntries(
      connection.id,
      remoteSelected.map((entry) => entry.path),
      localPath,
      policy,
    );
  };

  const resolveConflict = (policy: SftpConflictPolicy) => {
    dispatchConflict({ type: "choose", policy });
    if (!connection || !pendingTransfer) return;
    const paths = pendingTransfer.entries.map((entry) => entry.path);
    if (pendingTransfer.direction === "upload") {
      void sftpApi.uploadEntries(connection.id, paths, remotePath, policy);
    } else {
      void sftpApi.downloadEntries(connection.id, paths, localPath, policy);
    }
    setPendingTransfer(null);
  };

  const createRemoteFolder = async () => {
    if (!connection) return;
    const name = window.prompt(messages.newFolder);
    if (!name) return;
    await sftpApi.createRemoteDir(
      connection.id,
      joinRemotePath(remotePath, name),
    );
    await loadRemote();
  };

  const renameRemoteSelected = async () => {
    if (!connection || remoteSelected.length !== 1) return;
    const entry = remoteSelected[0];
    const name = window.prompt(messages.rename, entry.name);
    if (!name || name === entry.name) return;
    await sftpApi.renameRemote(
      connection.id,
      entry.path,
      joinRemotePath(dirname(entry.path), name),
    );
    await loadRemote();
  };

  const deleteRemoteSelected = async () => {
    if (!connection || remoteSelected.length === 0) return;
    if (!window.confirm(`${messages.delete} ${remoteSelected.length}?`)) return;
    await sftpApi.deleteRemote(
      connection.id,
      remoteSelected.map((entry) => entry.path),
    );
    await loadRemote();
  };

  const searchRemote = async () => {
    if (!connection) return;
    const query = window.prompt(messages.remoteSearchPrompt);
    const trimmed = query?.trim();
    if (!trimmed) return;
    setRemote((state) => ({ ...state, loading: true, error: null }));
    try {
      const entries = await sftpApi.searchRemote(
        connection.id,
        remotePath,
        trimmed,
      );
      setRemote({
        entries,
        selectedPaths: new Set(),
        anchorPath: null,
        loading: false,
        error: null,
      });
      setRemoteSearch({ query: trimmed, count: entries.length });
    } catch (err) {
      setRemote((state) => ({
        ...state,
        loading: false,
        error: String(err),
      }));
    }
  };

  const previewSync = (direction: SyncPlan["direction"]) => {
    setSyncPlan(
      buildSyncPlan({
        direction,
        localEntries: local.entries,
        remoteEntries: remote.entries,
      }),
    );
  };

  const applySync = async (plan: SyncPlan) => {
    if (!connection || plan.hasConflicts || plan.applyPaths.length === 0) {
      return;
    }
    if (plan.direction === "localToRemote") {
      await sftpApi.uploadEntries(
        connection.id,
        plan.applyPaths,
        remotePath,
        "overwrite",
      );
    } else {
      await sftpApi.downloadEntries(
        connection.id,
        plan.applyPaths,
        localPath,
        "overwrite",
      );
    }
    setSyncPlan(null);
  };

  const connectedSubtitle = useMemo(() => {
    if (!connection) return null;
    const profile = connection.profile;
    return `${profile.username}@${profile.host}:${profile.port}`;
  }, [connection]);
  const remoteSubtitle = useMemo(() => {
    const base = connectedSubtitle ?? undefined;
    if (!remoteSearch) return base;
    const searchLabel = messages.remoteSearchResults(
      remoteSearch.count,
      remoteSearch.query,
    );
    return base ? `${base} | ${searchLabel}` : searchLabel;
  }, [connectedSubtitle, messages, remoteSearch]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-border/60 bg-background">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border/60 bg-card/70 px-3">
        <div className="flex min-w-0 items-center gap-2">
          <HugeiconsIcon
            icon={ServerStack01Icon}
            size={16}
            strokeWidth={1.8}
            className="text-muted-foreground"
          />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">
              {connection?.profile.name ?? messages.title}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {connectedSubtitle ?? messages.notConnected}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {connection ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                void sftpApi.disconnect(connection.id);
                setConnection(null);
                setRemoteSearch(null);
                setSyncPlan(null);
                setRemote({
                  entries: [],
                  selectedPaths: new Set(),
                  anchorPath: null,
                  loading: false,
                  error: null,
                });
              }}
            >
              <HugeiconsIcon icon={Plug01Icon} size={14} strokeWidth={1.8} />
              {messages.disconnect}
            </Button>
          ) : null}
          <Button size="sm" onClick={() => setConnectOpen(true)}>
            {messages.connect}
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <SftpFilePane
          title={messages.local}
          side="local"
          path={localPath || "/"}
          entries={local.entries}
          selectedPaths={local.selectedPaths}
          selectedCount={localSelected.length}
          loading={local.loading}
          error={local.error}
          emptyLabel={messages.folderEmpty}
          onSelect={updateLocalSelection}
          onOpenDir={(entry) => setLocalPath(entry.path)}
          onPathChange={setLocalPath}
          onRefresh={() => void loadLocal()}
          primaryAction={{
            label: messages.upload,
            disabled: !canUpload,
            onClick: () => void uploadSelected(),
          }}
          actions={[
            {
              label: messages.upload,
              disabled: !canUpload,
              onClick: () => void uploadSelected(),
            },
            {
              label: messages.syncLocalToRemote,
              disabled: !canPreviewSync,
              onClick: () => previewSync("localToRemote"),
            },
            {
              label: messages.refresh,
              onClick: () => void loadLocal(),
            },
          ]}
        />
        <div className="w-px shrink-0 bg-border/60" />
        {connection ? (
          <SftpFilePane
            title={connection.profile.name}
            subtitle={remoteSubtitle}
            side="remote"
            path={remotePath}
            entries={remote.entries}
            selectedPaths={remote.selectedPaths}
            selectedCount={remoteSelected.length}
            loading={remote.loading}
            error={remote.error}
            emptyLabel={messages.folderEmpty}
            onSelect={updateRemoteSelection}
            onOpenDir={(entry) => setRemotePath(entry.path)}
            onPathChange={setRemotePath}
            onRefresh={() => void loadRemote()}
            primaryAction={{
              label: messages.download,
              disabled: !canDownload,
              onClick: () => void downloadSelected(),
            }}
            actions={[
              {
                label: messages.download,
                disabled: !canDownload,
                onClick: () => void downloadSelected(),
              },
              {
                label: messages.remoteSearch,
                onClick: () => void searchRemote(),
              },
              {
                label: messages.clearRemoteSearch,
                disabled: !remoteSearch,
                onClick: () => void loadRemote(),
              },
              {
                label: messages.syncRemoteToLocal,
                disabled: !canPreviewSync,
                onClick: () => previewSync("remoteToLocal"),
              },
              {
                label: messages.newFolder,
                onClick: () => void createRemoteFolder(),
              },
              {
                label: messages.rename,
                disabled: remoteSelected.length !== 1,
                onClick: () => void renameRemoteSelected(),
              },
              {
                label: messages.delete,
                destructive: true,
                disabled: remoteSelected.length === 0,
                onClick: () => void deleteRemoteSelected(),
              },
              {
                label: messages.refresh,
                onClick: () => void loadRemote(),
              },
            ]}
          />
        ) : (
          <section className="flex min-h-0 flex-1 items-center justify-center bg-background">
            <Button onClick={() => setConnectOpen(true)}>
              {messages.connect}
            </Button>
          </section>
        )}
      </div>

      <TransferQueue
        transfers={transfers}
        messages={messages}
        onClearCompleted={clearCompleted}
      />

      <ConflictDialog
        open={conflictState.open}
        conflicts={conflictState.conflicts}
        onOpenChange={(open) => {
          if (open) return;
          dispatchConflict({ type: "cancel" });
          setPendingTransfer(null);
        }}
        onResolve={resolveConflict}
      />

      <SyncPreview
        plan={syncPlan}
        onOpenChange={(open) => {
          if (!open) setSyncPlan(null);
        }}
        onApply={(plan) => void applySync(plan)}
      />

      <SftpConnectionDialog
        open={connectOpen}
        profiles={profiles}
        onOpenChange={setConnectOpen}
        onProfilesChange={setProfiles}
        onConnected={(result) => {
          setConnection({
            id: result.connectionId,
            profile: result.profile,
            fingerprint: result.fingerprint,
          });
          setRemoteSearch(null);
          setSyncPlan(null);
          setRemotePath(result.profile.defaultRemotePath);
        }}
      />
    </div>
  );
}

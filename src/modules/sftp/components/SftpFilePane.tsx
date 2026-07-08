import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useMessages } from "@/modules/i18n";
import { formatBytes, formatDate, formatKind } from "@/modules/sftp/lib/format";
import { splitRemotePath } from "@/modules/sftp/lib/path";
import type { SelectMode } from "@/modules/sftp/lib/selection";
import type { LocalEntry, SftpEntry } from "@/modules/sftp/lib/types";
import {
  ArrowUp01Icon,
  File01Icon,
  Folder01Icon,
  FolderSymlinkIcon,
  MoreHorizontalIcon,
  Refresh01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMemo, useState } from "react";

type Entry = (LocalEntry | SftpEntry) & { path: string };

type Props = {
  title: string;
  subtitle?: string;
  side: "local" | "remote";
  path: string;
  entries: Entry[];
  selectedPaths: Set<string>;
  selectedCount: number;
  loading?: boolean;
  error?: string | null;
  emptyLabel: string;
  onSelect: (entry: Entry, mode: SelectMode, visiblePaths: string[]) => void;
  onOpenDir: (entry: Entry) => void;
  onPathChange: (path: string) => void;
  onRefresh: () => void;
  primaryAction?: {
    label: string;
    disabled?: boolean;
    onClick: () => void;
  };
  actions?: {
    label: string;
    disabled?: boolean;
    destructive?: boolean;
    onClick: () => void;
  }[];
};

export function SftpFilePane({
  title,
  subtitle,
  side,
  path,
  entries,
  selectedPaths,
  selectedCount,
  loading,
  error,
  emptyLabel,
  onSelect,
  onOpenDir,
  onPathChange,
  onRefresh,
  primaryAction,
  actions = [],
}: Props) {
  const messages = useMessages().workspace.sftp;
  const [filter, setFilter] = useState("");
  const visible = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return entries;
    return entries.filter((entry) => entry.name.toLowerCase().includes(query));
  }, [entries, filter]);
  const visiblePaths = useMemo(
    () => visible.map((entry) => entry.path),
    [visible],
  );

  return (
    <section className="flex min-h-0 flex-1 flex-col border-border/60 bg-background">
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border/60 px-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{title}</div>
          {subtitle ? (
            <div className="truncate text-xs text-muted-foreground">
              {subtitle}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {selectedCount > 0 ? (
            <span className="text-xs text-muted-foreground">
              {messages.selectedCount(selectedCount)}
            </span>
          ) : null}
          {actions.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={messages.actions}
                  title={messages.actions}
                >
                  <HugeiconsIcon
                    icon={MoreHorizontalIcon}
                    size={14}
                    strokeWidth={2}
                  />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-44">
                {actions.map((action) => (
                  <DropdownMenuItem
                    key={action.label}
                    disabled={action.disabled}
                    variant={action.destructive ? "destructive" : "default"}
                    onSelect={action.onClick}
                  >
                    {action.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          {primaryAction ? (
            <Button
              size="sm"
              variant="secondary"
              disabled={primaryAction.disabled}
              onClick={primaryAction.onClick}
            >
              {primaryAction.label}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex h-10 shrink-0 items-center gap-1 border-b border-border/60 px-2">
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => onPathChange(parentPath(path))}
          aria-label={messages.up}
          title={messages.up}
        >
          <HugeiconsIcon icon={ArrowUp01Icon} size={14} strokeWidth={2} />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={onRefresh}
          aria-label={messages.refresh}
          title={messages.refresh}
        >
          <HugeiconsIcon icon={Refresh01Icon} size={14} strokeWidth={2} />
        </Button>
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden px-2 text-xs text-muted-foreground">
          {side === "remote"
            ? splitRemotePath(path).map((part) => (
                <button
                  key={part.path}
                  type="button"
                  className="min-w-0 shrink-0 rounded px-1 py-0.5 hover:bg-muted hover:text-foreground"
                  onClick={() => onPathChange(part.path)}
                >
                  {part.label}
                </button>
              ))
            : path}
        </div>
        <Input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder={messages.filter}
          className="h-7 w-28 rounded-md px-2 text-xs"
        />
      </div>

      <div className="grid h-8 shrink-0 grid-cols-[1.75rem_minmax(0,1fr)_8rem_5rem_5rem] items-center border-b border-border/60 px-3 text-[11px] uppercase tracking-wide text-muted-foreground">
        <div />
        <div>{messages.tableName}</div>
        <div>{messages.tableDateModified}</div>
        <div className="text-right">{messages.tableSize}</div>
        <div className="text-right">{messages.tableKind}</div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {loading ? (
          <div className="px-3 py-4 text-sm text-muted-foreground">
            {messages.loading}
          </div>
        ) : error ? (
          <div className="px-3 py-4 text-sm text-destructive">{error}</div>
        ) : visible.length === 0 ? (
          <div className="px-3 py-4 text-sm text-muted-foreground">
            {emptyLabel}
          </div>
        ) : (
          visible.map((entry) => {
            const selected = selectedPaths.has(entry.path);
            return (
              <button
                key={entry.path}
                type="button"
                role="row"
                aria-selected={selected}
                onClick={(event) =>
                  onSelect(
                    entry,
                    event.shiftKey
                      ? "range"
                      : event.metaKey || event.ctrlKey
                        ? "toggle"
                        : "replace",
                    visiblePaths,
                  )
                }
                onDoubleClick={() => {
                  if (entry.kind === "dir") onOpenDir(entry);
                }}
                className={cn(
                  "grid h-9 w-full grid-cols-[1.75rem_minmax(0,1fr)_8rem_5rem_5rem] items-center px-3 text-left text-sm hover:bg-muted/60",
                  selected && "bg-accent text-accent-foreground",
                )}
              >
                <span
                  className={cn(
                    "h-3.5 w-3.5 rounded border border-border/80",
                    selected && "border-primary bg-primary",
                  )}
                />
                <span className="flex min-w-0 items-center gap-2">
                  <EntryIcon kind={entry.kind} />
                  <span className="min-w-0">
                    <span className="block truncate">{entry.name}</span>
                    {"permissions" in entry && entry.permissions ? (
                      <span className="block truncate font-mono text-[10px] text-muted-foreground">
                        {entry.permissions}
                      </span>
                    ) : null}
                  </span>
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {formatDate(entry.mtime)}
                </span>
                <span className="text-right text-xs text-muted-foreground">
                  {entry.kind === "dir" ? "--" : formatBytes(entry.size)}
                </span>
                <span className="text-right text-xs text-muted-foreground">
                  {formatKind(entry.kind)}
                </span>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}

function EntryIcon({ kind }: { kind: Entry["kind"] }) {
  const icon =
    kind === "dir"
      ? Folder01Icon
      : kind === "symlink"
        ? FolderSymlinkIcon
        : File01Icon;
  return (
    <HugeiconsIcon
      icon={icon}
      size={15}
      strokeWidth={1.8}
      className="shrink-0 text-muted-foreground"
    />
  );
}

function parentPath(path: string): string {
  const normalized = path.replace(/\\/g, "/").replace(/\/+$/, "");
  const idx = normalized.lastIndexOf("/");
  if (idx <= 0) return normalized.includes(":") ? normalized : "/";
  return normalized.slice(0, idx);
}

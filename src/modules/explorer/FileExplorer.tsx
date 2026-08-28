import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { IS_MAC } from "@/lib/platform";
import { useMessages } from "@/modules/i18n";
import { Folder01Icon, Refresh01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { EntryRow, StatusRow, type RowActions } from "./TreeRow";
import { copyToClipboard, revealInFinder } from "./lib/contextActions";
import { folderIconUrl } from "./lib/iconResolver";
import { COMPACT_CONTENT, COMPACT_ITEM } from "./lib/menuItemClass";
import { useFileTree } from "./lib/useFileTree";

export type FileExplorerHandle = {
  focus: () => void;
  isFocused: () => boolean;
};

type Props = {
  rootPath: string | null;
  onRevealInTerminal?: (path: string) => void;
};

type Row =
  | {
      kind: "entry";
      key: string;
      path: string;
      name: string;
      isDir: boolean;
      isExpanded: boolean;
      depth: number;
    }
  | {
      kind: "status";
      key: string;
      depth: number;
      tone: "muted" | "error";
      message: string;
    };

const ROW_HEIGHT = 24;
const OVERSCAN = 8;

function basename(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : path;
}

function buildRows(
  rootPath: string,
  nodes: ReturnType<typeof useFileTree>["nodes"],
  expanded: ReturnType<typeof useFileTree>["expanded"],
  join: ReturnType<typeof useFileTree>["joinPath"],
  loadingMessage: string,
): { rows: Row[]; entryIndexByPath: Map<string, number> } {
  const rows: Row[] = [];
  const entryIndexByPath = new Map<string, number>();

  const walk = (parent: string, depth: number) => {
    const node = nodes[parent];
    if (node?.status !== "loaded") return;
    for (const entry of node.entries) {
      const path = join(parent, entry.name);
      const isDir = entry.kind === "dir";
      const isExpanded = isDir && expanded.has(path);

      entryIndexByPath.set(path, rows.length);
      rows.push({
        kind: "entry",
        key: path,
        path,
        name: entry.name,
        isDir,
        isExpanded,
        depth,
      });

      if (!isDir || !isExpanded) continue;
      const child = nodes[path];
      if (child?.status === "loading") {
        rows.push({
          kind: "status",
          key: `loading:${path}`,
          depth: depth + 1,
          tone: "muted",
          message: loadingMessage,
        });
      } else if (child?.status === "error") {
        rows.push({
          kind: "status",
          key: `error:${path}`,
          depth: depth + 1,
          tone: "error",
          message: child.message,
        });
      } else if (child?.status === "loaded") {
        walk(path, depth + 1);
      }
    }
  };

  walk(rootPath, 0);
  return { rows, entryIndexByPath };
}

export const FileExplorer = memo(
  forwardRef<FileExplorerHandle, Props>(function FileExplorer(
    { rootPath, onRevealInTerminal },
    ref,
  ) {
    const messages = useMessages().workspace.explorer;
    const revealLabel = IS_MAC
      ? messages.revealInFinder
      : messages.revealInFileManager;
    const tree = useFileTree(rootPath);
    const [selectedPath, setSelectedPath] = useState<string | null>(null);
    const [menuTarget, setMenuTarget] = useState<{
      path: string;
      name: string;
      isDir: boolean;
    } | null>(null);
    const [menuNonce, setMenuNonce] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    const { rows, entryIndexByPath } = useMemo(() => {
      if (!rootPath) {
        return {
          rows: [] as Row[],
          entryIndexByPath: new Map<string, number>(),
        };
      }
      return buildRows(
        rootPath,
        tree.nodes,
        tree.expanded,
        tree.joinPath,
        messages.loading,
      );
    }, [rootPath, tree.nodes, tree.expanded, tree.joinPath, messages.loading]);

    const rowActions = useMemo<RowActions>(
      () => ({
        toggle: tree.toggle,
      }),
      [tree.toggle],
    );

    const entryPaths = useMemo<string[]>(() => {
      const out: string[] = [];
      for (const row of rows) if (row.kind === "entry") out.push(row.path);
      return out;
    }, [rows]);

    useEffect(() => {
      if (selectedPath && !entryIndexByPath.has(selectedPath)) {
        setSelectedPath(null);
      }
    }, [entryIndexByPath, selectedPath]);

    const virtualizer = useVirtualizer({
      count: rows.length,
      getScrollElement: () => scrollRef.current,
      estimateSize: () => ROW_HEIGHT,
      overscan: OVERSCAN,
      getItemKey: (index) => rows[index]?.key ?? index,
    });

    const scrollEntryIntoView = useCallback(
      (path: string) => {
        const index = entryIndexByPath.get(path);
        if (index === undefined) return;
        virtualizer.scrollToIndex(index, { align: "auto" });
      },
      [entryIndexByPath, virtualizer],
    );

    useImperativeHandle(
      ref,
      () => ({
        focus: () => {
          containerRef.current?.focus();
          if (!selectedPath && entryPaths.length > 0) {
            const first = entryPaths[0];
            setSelectedPath(first);
            requestAnimationFrame(() => scrollEntryIntoView(first));
          }
        },
        isFocused: () => {
          const c = containerRef.current;
          if (!c) return false;
          const active = document.activeElement;
          return active instanceof Node && c.contains(active);
        },
      }),
      [entryPaths, scrollEntryIntoView, selectedPath],
    );

    if (!rootPath) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
          <HugeiconsIcon
            icon={Folder01Icon}
            size={24}
            strokeWidth={1.5}
            className="text-muted-foreground"
          />
          <div className="text-xs text-muted-foreground">
            {messages.noCurrentDirectory}
          </div>
        </div>
      );
    }

    const root = tree.nodes[rootPath];

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }
      if (entryPaths.length === 0) return;

      const currentIdx = selectedPath ? entryPaths.indexOf(selectedPath) : -1;
      const move = (next: number) => {
        const clamped = Math.max(0, Math.min(entryPaths.length - 1, next));
        const path = entryPaths[clamped];
        setSelectedPath(path);
        requestAnimationFrame(() => scrollEntryIntoView(path));
      };

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          move(currentIdx < 0 ? 0 : currentIdx + 1);
          break;
        case "ArrowUp":
          e.preventDefault();
          move(currentIdx < 0 ? entryPaths.length - 1 : currentIdx - 1);
          break;
        case "ArrowRight": {
          if (currentIdx < 0) return;
          e.preventDefault();
          const path = entryPaths[currentIdx];
          const idx = entryIndexByPath.get(path);
          if (idx === undefined) break;
          const row = rows[idx];
          if (row.kind !== "entry") break;
          if (row.isDir) {
            if (!row.isExpanded) tree.toggle(row.path);
            else move(currentIdx + 1);
          }
          break;
        }
        case "ArrowLeft": {
          if (currentIdx < 0) return;
          e.preventDefault();
          const path = entryPaths[currentIdx];
          const idx = entryIndexByPath.get(path);
          if (idx === undefined) break;
          const row = rows[idx];
          if (row.kind !== "entry") break;
          if (row.isDir && row.isExpanded) {
            tree.toggle(row.path);
          } else {
            const parent = row.path.slice(0, row.path.lastIndexOf("/"));
            if (parent && parent !== rootPath) setSelectedPath(parent);
          }
          break;
        }
        case "Enter": {
          if (currentIdx < 0) return;
          e.preventDefault();
          const path = entryPaths[currentIdx];
          const idx = entryIndexByPath.get(path);
          if (idx === undefined) break;
          const row = rows[idx];
          if (row.kind !== "entry") break;
          if (row.isDir) tree.toggle(row.path);
          break;
        }
      }
    };

    const renderRow = (row: Row) => {
      if (row.kind === "status") {
        return (
          <StatusRow depth={row.depth} message={row.message} tone={row.tone} />
        );
      }
      return (
        <EntryRow
          path={row.path}
          name={row.name}
          isDir={row.isDir}
          isExpanded={row.isExpanded}
          depth={row.depth}
          actions={rowActions}
          isSelected={selectedPath === row.path}
          onSelectPath={setSelectedPath}
        />
      );
    };

    return (
      <div
        ref={containerRef}
        role="tree"
        className="flex h-full flex-col outline-none"
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <div className="flex h-8 shrink-0 items-center gap-1 border-b border-border/60 px-2">
          <span
            className="flex flex-1 items-center truncate text-xs font-medium text-foreground/80"
            title={rootPath}
          >
            <img
              src={folderIconUrl(basename(rootPath), false)}
              alt=""
              height={15}
              width={15}
              className="mx-1.5"
            />
            {basename(rootPath)}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 text-muted-foreground hover:text-foreground"
            onClick={() => tree.refresh(rootPath)}
            title={messages.refresh}
          >
            <HugeiconsIcon icon={Refresh01Icon} size={12} strokeWidth={2} />
          </Button>
        </div>

        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              ref={scrollRef}
              className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]"
              onContextMenuCapture={(e) => {
                const el = (e.target as HTMLElement).closest<HTMLElement>(
                  "[data-fs-path]",
                );
                const path = el?.getAttribute("data-fs-path") ?? null;
                const idx = path != null ? entryIndexByPath.get(path) : undefined;
                const row = idx !== undefined ? rows[idx] : undefined;
                setMenuTarget(
                  row && row.kind === "entry"
                    ? { path: row.path, name: row.name, isDir: row.isDir }
                    : null,
                );
                setMenuNonce((n) => n + 1);
              }}
            >
              {root?.status === "loading" && (
                <div className="px-3 py-2 text-[11px] text-muted-foreground">
                  {messages.loading}
                </div>
              )}
              {root?.status === "error" && (
                <div className="px-3 py-2 text-[11px] text-destructive">
                  {root.message}
                </div>
              )}
              {root?.status === "loaded" ? (
                <div
                  style={{
                    height: virtualizer.getTotalSize(),
                    position: "relative",
                    width: "100%",
                  }}
                >
                  {virtualizer.getVirtualItems().map((virtualRow) => {
                    const row = rows[virtualRow.index];
                    if (!row) return null;
                    return (
                      <div
                        key={virtualRow.key}
                        data-virtual-row-index={virtualRow.index}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: virtualRow.size,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        {renderRow(row)}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent key={menuNonce} className={COMPACT_CONTENT}>
            {menuTarget ? (
              <>
                {menuTarget.isDir && onRevealInTerminal && (
                  <ContextMenuItem
                    className={COMPACT_ITEM}
                    onSelect={() => onRevealInTerminal(menuTarget.path)}
                  >
                    {messages.openInTerminal}
                  </ContextMenuItem>
                )}
                <ContextMenuItem
                  className={COMPACT_ITEM}
                  onSelect={() => void revealInFinder(menuTarget.path)}
                >
                  {revealLabel}
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  className={COMPACT_ITEM}
                  onSelect={() => void copyToClipboard(menuTarget.path)}
                >
                  {messages.copyPath}
                </ContextMenuItem>
                {menuTarget.isDir && (
                  <ContextMenuItem
                    className={COMPACT_ITEM}
                    onSelect={() => tree.refresh(menuTarget.path)}
                  >
                    {messages.refresh}
                  </ContextMenuItem>
                )}
              </>
            ) : (
              <>
                {onRevealInTerminal && (
                  <ContextMenuItem
                    className={COMPACT_ITEM}
                    onSelect={() => onRevealInTerminal(rootPath)}
                  >
                    {messages.openInTerminal}
                  </ContextMenuItem>
                )}
                <ContextMenuItem
                  className={COMPACT_ITEM}
                  onSelect={() => void revealInFinder(rootPath)}
                >
                  {revealLabel}
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  className={COMPACT_ITEM}
                  onSelect={() => void copyToClipboard(rootPath)}
                >
                  {messages.copyPath}
                </ContextMenuItem>
                <ContextMenuItem
                  className={COMPACT_ITEM}
                  onSelect={() => tree.refresh(rootPath)}
                >
                  {messages.refresh}
                </ContextMenuItem>
              </>
            )}
          </ContextMenuContent>
        </ContextMenu>
      </div>
    );
  }),
);

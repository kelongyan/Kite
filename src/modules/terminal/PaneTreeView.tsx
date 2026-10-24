import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import type { GroupImperativeHandle } from "react-resizable-panels";
import { useMessages } from "@/modules/i18n";
import { Fragment, useState } from "react";
import {
  Cancel01Icon,
  ClipboardPasteIcon,
  Copy01Icon,
  Delete02Icon,
  Maximize02Icon,
  LayoutTwoColumnIcon,
  LayoutTwoRowIcon,
  Search01Icon,
  Grid2X2Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTerminalDropStore } from "./lib/dropStore";
import {
  MAX_PANES_PER_TAB,
  hasLeaf,
  leafIds,
  type PaneNode,
} from "./lib/panes";
import {
  clearLeafTerminal,
  copyLeafSelection,
  focusSlot,
  leafHasSelection,
  requestLeafPaste,
} from "./lib/rendererPool";
import { useTerminalSearchStore } from "./lib/terminalSearchStore";
import { TerminalPane, type TerminalPaneHandle } from "./TerminalPane";

/** Pane-level commands the menu cannot run on its own (they touch the tab). */
export type PaneCommand =
  | "splitRight"
  | "splitDown"
  | "close"
  | "zoom"
  | "equalize";

type LeafBundle = {
  setRef: (h: TerminalPaneHandle | null) => void;
  onCwd: (leafId: number, cwd: string) => void;
  onExit: (leafId: number, code: number) => void;
};

type Props = {
  node: PaneNode;
  tabVisible: boolean;
  activeLeafId: number;
  onFocusLeaf: (leafId: number) => void;
  getBundle: (leafId: number) => LeafBundle;
  paneCount: number;
  canClosePane: boolean;
  /** Set while one pane of this tab is maximized (tmux `z`). */
  zoomedLeafId?: number;
  onPaneCommand: (leafId: number, command: PaneCommand) => void;
};

// Group handles keyed by split-node id, so "equalize panes" can set an even
// layout per group without reverse-engineering the resize state.
const paneGroupHandles = new Map<
  number,
  { childIds: number[]; handle: GroupImperativeHandle }
>();

/** Reset every split in the tree to an even layout. */
export function equalizePaneTree(tree: PaneNode): boolean {
  if (tree.kind === "leaf") return false;
  const entry = paneGroupHandles.get(tree.id);
  if (entry) {
    const share = 100 / tree.children.length;
    entry.handle.setLayout(
      Object.fromEntries(
        entry.childIds.map((id) => [`pane-${id}`, share]),
      ),
    );
  }
  let touched = Boolean(entry);
  for (const child of tree.children) {
    if (equalizePaneTree(child)) touched = true;
  }
  return touched;
}

export function PaneTreeView(props: Props) {
  const { node } = props;
  if (node.kind === "leaf") {
    return (
      <PaneLeaf
        {...props}
        leafId={node.id}
        initialCwd={node.cwd}
        initialShell={node.shell}
      />
    );
  }

  // Zoomed: render only the subtree owning the zoomed leaf. Sibling panes
  // unmount while their PTYs stay alive — same philosophy as hidden tabs.
  const zoomedLeafId = props.zoomedLeafId;
  const zoomedChild =
    zoomedLeafId === undefined
      ? undefined
      : node.children.find((c) => hasLeaf(c, zoomedLeafId));
  if (zoomedChild) {
    return <PaneTreeView {...props} node={zoomedChild} />;
  }

  const childIds = node.children.map((c) => c.id);
  return (
    <ResizablePanelGroup
      orientation={node.dir === "row" ? "horizontal" : "vertical"}
      groupRef={(handle) => {
        if (handle) paneGroupHandles.set(node.id, { childIds, handle });
        else paneGroupHandles.delete(node.id);
      }}
    >
      {node.children.map((child, i) => (
        // Keyed by the subtree's first leaf, not the node id: when a leaf is
        // split in place, the replacing split node gets a fresh id and would
        // otherwise remount the surviving pane.
        <Fragment key={leafIds(child)[0]}>
          {i > 0 && <ResizableHandle />}
          <ResizablePanel id={`pane-${child.id}`} minSize="10%">
            <PaneTreeView {...props} node={child} />
          </ResizablePanel>
        </Fragment>
      ))}
    </ResizablePanelGroup>
  );
}

function PaneLeaf({
  leafId,
  initialCwd,
  initialShell,
  tabVisible,
  activeLeafId,
  zoomedLeafId,
  onFocusLeaf,
  getBundle,
  paneCount,
  canClosePane,
  onPaneCommand,
}: Props & {
  leafId: number;
  initialCwd?: string;
  initialShell?: string;
}) {
  const messages = useMessages();
  const t = messages.mainShell.terminalMenu;
  const focused = leafId === activeLeafId;
  const zoomed = zoomedLeafId === leafId;
  const b = getBundle(leafId);
  // Selection state is sampled when the menu opens: it decides whether copy is
  // enabled, which cannot be derived from props at render time.
  const [copyEnabled, setCopyEnabled] = useState(false);
  const splitDisabled = paneCount >= MAX_PANES_PER_TAB;

  const itemClass = "gap-2 rounded-xl px-2.5 py-1.5 text-[13px]";

  return (
    <ContextMenu
      onOpenChange={(open) => {
        if (!open) return;
        setCopyEnabled(leafHasSelection(leafId));
        if (!focused) onFocusLeaf(leafId);
      }}
    >
      <ContextMenuTrigger asChild>
        {/* A layout wrapper, not a control: it keeps the pane tree's active
         * leaf in sync with DOM focus from any focus path. */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: focus synchronization on a layout container, not an interactive control */}
        <div
          onMouseDownCapture={() => {
            if (!focused) onFocusLeaf(leafId);
          }}
          // Catches focus from Tab, programmatic focus, or any path that
          // skips mousedown — keeps activeLeafId in sync with DOM focus.
          onFocus={() => {
            if (!focused) onFocusLeaf(leafId);
          }}
          data-pane-leaf={leafId}
          className="relative h-full w-full"
        >
          <TerminalPane
            leafId={leafId}
            visible={tabVisible}
            focused={focused}
            initialCwd={initialCwd}
            shell={initialShell}
            ref={b.setRef}
            onCwd={b.onCwd}
            onExit={b.onExit}
          />
          <DropOverlay leafId={leafId} />
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent
        className="min-w-32 p-1"
        onCloseAutoFocus={(e) => {
          // Keep keyboard focus in the terminal instead of the pane wrapper.
          e.preventDefault();
          focusSlot(leafId);
        }}
      >
        <ContextMenuItem
          className={itemClass}
          disabled={!copyEnabled}
          onSelect={() => copyLeafSelection(leafId)}
        >
          <HugeiconsIcon icon={Copy01Icon} size={13} strokeWidth={1.75} />
          <span className="flex-1">{t.copy}</span>
        </ContextMenuItem>
        <ContextMenuItem
          className={itemClass}
          onSelect={() => requestLeafPaste(leafId)}
        >
          <HugeiconsIcon
            icon={ClipboardPasteIcon}
            size={13}
            strokeWidth={1.75}
          />
          <span className="flex-1">{t.paste}</span>
        </ContextMenuItem>
        <ContextMenuItem
          className={itemClass}
          onSelect={() => useTerminalSearchStore.getState().openSearch()}
        >
          <HugeiconsIcon icon={Search01Icon} size={13} strokeWidth={1.75} />
          <span className="flex-1">{t.search}</span>
        </ContextMenuItem>
        <ContextMenuItem
          className={itemClass}
          onSelect={() => clearLeafTerminal(leafId)}
        >
          <HugeiconsIcon icon={Delete02Icon} size={13} strokeWidth={1.75} />
          <span className="flex-1">{t.clear}</span>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          className={itemClass}
          disabled={splitDisabled}
          onSelect={() => onPaneCommand(leafId, "splitRight")}
        >
          <HugeiconsIcon
            icon={LayoutTwoColumnIcon}
            size={13}
            strokeWidth={1.75}
          />
          <span className="flex-1">{t.splitRight}</span>
        </ContextMenuItem>
        <ContextMenuItem
          className={itemClass}
          disabled={splitDisabled}
          onSelect={() => onPaneCommand(leafId, "splitDown")}
        >
          <HugeiconsIcon icon={LayoutTwoRowIcon} size={13} strokeWidth={1.75} />
          <span className="flex-1">{t.splitDown}</span>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          className={itemClass}
          disabled={paneCount < 2}
          onSelect={() => onPaneCommand(leafId, "zoom")}
        >
          <HugeiconsIcon icon={Maximize02Icon} size={13} strokeWidth={1.75} />
          <span className="flex-1">{zoomed ? t.unzoomPane : t.zoomPane}</span>
        </ContextMenuItem>
        <ContextMenuItem
          className={itemClass}
          disabled={paneCount < 2 || zoomedLeafId !== undefined}
          onSelect={() => onPaneCommand(leafId, "equalize")}
        >
          <HugeiconsIcon
            icon={Grid2X2Icon}
            size={13}
            strokeWidth={1.75}
          />
          <span className="flex-1">{t.equalizePanes}</span>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          className={itemClass}
          disabled={!canClosePane}
          onSelect={() => onPaneCommand(leafId, "close")}
        >
          <HugeiconsIcon icon={Cancel01Icon} size={13} strokeWidth={1.75} />
          <span className="flex-1">{t.closePane}</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

function DropOverlay({ leafId }: { leafId: number }) {
  const active = useTerminalDropStore((s) => s.targetLeafId === leafId);
  const messages = useMessages();
  if (!active) return null;
  return (
    <div className="kite-drop-overlay pointer-events-none absolute inset-2 grid place-items-center rounded-lg border border-primary/45 bg-background/70 text-xs font-medium text-foreground shadow-lg">
      {messages.common.dropFileHint}
    </div>
  );
}

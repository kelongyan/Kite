import type { SearchTarget } from "@/modules/header";
import { zhCN, type Messages } from "@/modules/i18n/messages/zh-CN";
import { MAX_PANES_PER_TAB, type Tab } from "@/modules/tabs";
import { leafIds } from "@/modules/terminal";
import {
  Cancel01Icon,
  FileEditIcon,
  KeyboardIcon,
  LayoutTwoColumnIcon,
  LayoutTwoRowIcon,
  PaintBoardIcon,
  Search01Icon,
  ServerStack01Icon,
  Settings01Icon,
  SidebarLeftIcon,
  SourceCodeIcon,
  TerminalIcon,
} from "@hugeicons/core-free-icons";
import type { PaletteItem } from "./types";

type CommandPaletteMessages = Messages["mainShell"]["commandPalette"];
type CommandMessageKey = keyof CommandPaletteMessages["commands"];

export const COMMAND_GROUPS = [
  "General",
  "Tabs",
  "Panes",
  "Git",
  "Search",
  "View",
] as const;

export type CommandPaletteActionContext = {
  tabs: Tab[];
  activeId: number;
  searchTarget: SearchTarget;
  explorerRoot: string | null;
  home: string | null;
  openNewTab: () => void;
  openNewEditor: () => void;
  openSftp: () => void;
  openGitGraph: () => void;
  toggleSourceControl: () => void;
  closeActiveTabOrPane: () => void;
  splitPaneRight: () => void;
  splitPaneDown: () => void;
  focusSearch: () => void;
  focusExplorerSearch: () => void;
  toggleSidebar: () => void;
  openSettings: () => void;
  openKeyboardShortcuts: () => void;
};

const noop = () => {};

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function createCommandItems(
  ctx: CommandPaletteActionContext,
  messages: CommandPaletteMessages = zhCN.mainShell.commandPalette,
): PaletteItem[] {
  const activeTab = ctx.tabs.find((tab) => tab.id === ctx.activeId);
  const activeTerminalTab = activeTab?.kind === "terminal" ? activeTab : null;
  const activePaneCount = activeTerminalTab
    ? leafIds(activeTerminalTab.paneTree).length
    : 0;
  const onlyOneTab = ctx.tabs.length < 2;
  const noWorkspaceRoot = !ctx.explorerRoot && !ctx.home;
  const splitDisabled = !activeTerminalTab
    ? messages.disabled.noTerminalTab
    : activePaneCount >= MAX_PANES_PER_TAB
      ? messages.disabled.paneLimit
      : undefined;
  const closeDisabled =
    onlyOneTab && activePaneCount < 2 ? messages.disabled.lastTab : undefined;

  const command = (key: CommandMessageKey) => {
    const localized = messages.commands[key];
    return {
      title: localized.title,
      keywords: unique([
        localized.title,
        ...localized.keywords,
      ]),
    };
  };

  const item = (
    key: CommandMessageKey,
    groupKey: (typeof COMMAND_GROUPS)[number],
  ) => ({
    ...command(key),
    groupKey,
    group: messages.groups[groupKey],
  });

  return [
    {
      id: "settings.open",
      ...item("openSettings", "General"),
      icon: Settings01Icon,
      shortcutId: "settings.open",
      run: ctx.openSettings,
    },
    {
      id: "theme.pick",
      ...item("changeTheme", "General"),
      icon: PaintBoardIcon,
      run: noop,
    },
    {
      id: "shortcuts.open",
      ...item("keyboardShortcuts", "General"),
      icon: KeyboardIcon,
      run: ctx.openKeyboardShortcuts,
    },

    {
      id: "tab.new",
      ...item("newTerminal", "Tabs"),
      icon: TerminalIcon,
      shortcutId: "tab.new",
      run: ctx.openNewTab,
    },
    {
      id: "tab.newEditor",
      ...item("newEditorTab", "Tabs"),
      icon: FileEditIcon,
      shortcutId: "tab.newEditor",
      disabledReason: noWorkspaceRoot
        ? messages.disabled.noWorkspaceRoot
        : undefined,
      run: ctx.openNewEditor,
    },
    {
      id: "sftp.open",
      ...item("openSftp", "Tabs"),
      icon: ServerStack01Icon,
      run: ctx.openSftp,
    },
    {
      id: "tab.close",
      ...item("closeTabOrPane", "Tabs"),
      icon: Cancel01Icon,
      shortcutId: "tab.close",
      disabledReason: closeDisabled,
      run: ctx.closeActiveTabOrPane,
    },
    {
      id: "pane.splitRight",
      ...item("splitPaneRight", "Panes"),
      icon: LayoutTwoColumnIcon,
      shortcutId: "pane.splitRight",
      disabledReason: splitDisabled,
      run: ctx.splitPaneRight,
    },
    {
      id: "pane.splitDown",
      ...item("splitPaneDown", "Panes"),
      icon: LayoutTwoRowIcon,
      shortcutId: "pane.splitDown",
      disabledReason: splitDisabled,
      run: ctx.splitPaneDown,
    },
    {
      id: "git.graph",
      ...item("openGitGraph", "Git"),
      icon: SourceCodeIcon,
      run: ctx.openGitGraph,
    },
    {
      id: "git.source",
      ...item("toggleSourceControl", "Git"),
      icon: SourceCodeIcon,
      shortcutId: "pane.source",
      run: ctx.toggleSourceControl,
    },
    {
      id: "search.focus",
      ...item("findInCurrentTab", "Search"),
      icon: Search01Icon,
      shortcutId: "search.focus",
      disabledReason: ctx.searchTarget
        ? undefined
        : messages.disabled.noSearchableView,
      run: ctx.focusSearch,
    },
    {
      id: "explorer.search",
      ...item("searchFilesByName", "Search"),
      icon: Search01Icon,
      shortcutId: "explorer.search",
      disabledReason: ctx.explorerRoot
        ? undefined
        : messages.disabled.noWorkspaceRoot,
      run: ctx.focusExplorerSearch,
    },
    {
      id: "sidebar.toggle",
      ...item("toggleFileExplorer", "View"),
      icon: SidebarLeftIcon,
      shortcutId: "sidebar.toggle",
      run: ctx.toggleSidebar,
    },
  ];
}

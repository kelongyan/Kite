import { messagesFor } from "@/modules/i18n";
import { describe, expect, it } from "vitest";
import {
  type CommandPaletteActionContext,
  createCommandItems,
} from "./commands";

const noop = () => {};

function context(
  overrides: Partial<CommandPaletteActionContext> = {},
): CommandPaletteActionContext {
  return {
    tabs: [],
    activeId: 0,
    searchTarget: null,
    explorerRoot: "F:/repo",
    home: "C:/Users/Administrator",
    openNewTab: noop,
    openNewBlock: noop,
    openNewPrivate: noop,
    openNewEditor: noop,
    openNewPreview: noop,
    openGitGraph: noop,
    toggleSourceControl: noop,
    closeActiveTabOrPane: noop,
    splitPaneRight: noop,
    splitPaneDown: noop,
    focusSearch: noop,
    focusExplorerSearch: noop,
    toggleSidebar: noop,
    toggleAi: noop,
    askAiSelection: noop,
    openSettings: noop,
    openKeyboardShortcuts: noop,
    spaces: [],
    activeSpaceId: null,
    openSpacesOverview: noop,
    newSpace: noop,
    switchSpace: noop,
    ...overrides,
  };
}

describe("createCommandItems", () => {
  it("uses localized command titles and disabled reasons while retaining English keywords", () => {
    const messages = messagesFor("zh-CN").mainShell.commandPalette;
    const items = createCommandItems(context(), messages);

    const settings = items.find((item) => item.id === "settings.open");
    const splitRight = items.find(
      (item) => item.id === "pane.splitRight",
    );

    expect(settings?.title).toBe("打开设置");
    expect(settings?.keywords).toContain("preferences");
    expect(splitRight?.disabledReason).toBe("没有终端标签");
  });
});

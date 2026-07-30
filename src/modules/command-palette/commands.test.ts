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
    openNewEditor: noop,
    openSftp: noop,
    openGitGraph: noop,
    toggleSourceControl: noop,
    closeActiveTabOrPane: noop,
    splitPaneRight: noop,
    splitPaneDown: noop,
    focusSearch: noop,
    focusExplorerSearch: noop,
    toggleSidebar: noop,
    openSettings: noop,
    openKeyboardShortcuts: noop,
    ...overrides,
  };
}

describe("createCommandItems", () => {
  it("uses localized command titles and disabled reasons", () => {
    const messages = messagesFor("zh-CN").mainShell.commandPalette;
    const items = createCommandItems(context(), messages);

    const settings = items.find((item) => item.id === "settings.open");
    const splitRight = items.find(
      (item) => item.id === "pane.splitRight",
    );

    expect(settings?.title).toBe("打开设置");
    expect(settings?.keywords).toContain("偏好");
    expect(splitRight?.disabledReason).toBe("没有终端标签");
  });

  it("runs the Open SFTP action", () => {
    let opened = false;
    const items = createCommandItems(
      context({
        openSftp: () => {
          opened = true;
        },
      }),
    );

    items.find((item) => item.id === "sftp.open")?.run();

    expect(opened).toBe(true);
  });
});

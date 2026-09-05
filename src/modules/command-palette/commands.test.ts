import { zhCN } from "@/modules/i18n/messages/zh-CN";
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
    openNewTab: noop,
    closeActiveTabOrPane: noop,
    splitPaneRight: noop,
    splitPaneDown: noop,
    openSettings: noop,
    openKeyboardShortcuts: noop,
    ...overrides,
  };
}

describe("createCommandItems", () => {
  it("uses localized command titles and disabled reasons", () => {
    const messages = zhCN.mainShell.commandPalette;
    const items = createCommandItems(context(), messages);

    const settings = items.find((item) => item.id === "settings.open");
    const splitRight = items.find((item) => item.id === "pane.splitRight");

    expect(settings?.title).toBe("打开设置");
    expect(settings?.keywords).toContain("偏好");
    expect(splitRight?.disabledReason).toBe("没有终端标签");
  });

  it("runs the new terminal tab action", () => {
    let opened = false;
    const items = createCommandItems(
      context({
        openNewTab: () => {
          opened = true;
        },
      }),
    );

    items.find((item) => item.id === "tab.new")?.run();

    expect(opened).toBe(true);
  });
});

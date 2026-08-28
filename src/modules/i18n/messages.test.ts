import { describe, expect, it } from "vitest";
import { zhCN } from "./messages/zh-CN";

describe("message dictionaries", () => {
  it("includes Simplified Chinese messages", () => {
    expect(zhCN.settings.tabs.general).toBe("通用");
    expect(zhCN.settings.general.appearance.system).toBe("跟随系统");
    expect(zhCN.settings.themes.theme.importTheme).toBe("导入 .kite-theme");
    expect(zhCN.settings.shortcuts.searchPlaceholder).toBe("搜索快捷键...");
    expect(zhCN.settings.about.actions.viewOnGitHub).toBe("在 GitHub 查看");
  });
});

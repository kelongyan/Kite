import { describe, expect, it } from "vitest";
import { formatCompactNumber, formatNumber, formatPercent } from "./format";
import { APP_LANGUAGES, LANGUAGE_LABELS, coerceAppLanguage } from "./locale";
import { zhCN } from "./messages/zh-CN";

describe("app language metadata", () => {
  it("lists the supported languages and native labels", () => {
    expect(APP_LANGUAGES).toEqual(["zh-CN"]);
    expect(LANGUAGE_LABELS["zh-CN"]).toBe("简体中文");
  });

  it("coerces any language value to zh-CN", () => {
    expect(coerceAppLanguage("en")).toBe("zh-CN");
    expect(coerceAppLanguage("zh-CN")).toBe("zh-CN");
    expect(coerceAppLanguage(null)).toBe("zh-CN");
  });
});

describe("message dictionaries", () => {
  it("includes Simplified Chinese messages", () => {
    expect(zhCN.settings.tabs.general).toBe("通用");
    expect(zhCN.settings.general.appearance.system).toBe("跟随系统");
    expect(zhCN.settings.themes.editorTheme.title).toBe("编辑器主题");
    expect(zhCN.settings.shortcuts.searchPlaceholder).toBe("搜索快捷键...");
    expect(zhCN.settings.about.actions.viewOnGitHub).toBe("在 GitHub 查看");
  });
});

describe("locale-aware formatting", () => {
  it("formats standard numbers by locale", () => {
    expect(formatNumber("zh-CN", 25000)).toBe("25,000");
  });

  it("formats compact numbers by locale", () => {
    expect(formatCompactNumber("zh-CN", 12000)).toBe("1.2万");
  });

  it("formats percentages by locale", () => {
    expect(formatPercent("zh-CN", 0.42)).toBe("42%");
  });
});

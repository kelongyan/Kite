import { describe, expect, it } from "vitest";
import { formatCompactNumber, formatNumber, formatPercent } from "./format";
import { APP_LANGUAGES, LANGUAGE_LABELS, coerceAppLanguage } from "./locale";
import { en } from "./messages/en";
import { zhCN } from "./messages/zh-CN";

function collectKeys(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object") return [prefix];
  return Object.entries(value).flatMap(([key, child]) => {
    const next = prefix ? `${prefix}.${key}` : key;
    return collectKeys(child, next);
  });
}

describe("app language metadata", () => {
  it("lists the supported languages and native labels", () => {
    expect(APP_LANGUAGES).toEqual(["en", "zh-CN"]);
    expect(LANGUAGE_LABELS.en).toBe("English");
    expect(LANGUAGE_LABELS["zh-CN"]).toBe("简体中文");
  });

  it("coerces unsupported language values to English", () => {
    expect(coerceAppLanguage("en")).toBe("en");
    expect(coerceAppLanguage("zh-CN")).toBe("zh-CN");
    expect(coerceAppLanguage("zh")).toBe("en");
    expect(coerceAppLanguage("")).toBe("en");
    expect(coerceAppLanguage(null)).toBe("en");
  });
});

describe("message dictionaries", () => {
  it("keeps Simplified Chinese keys aligned with English", () => {
    expect(collectKeys(zhCN).sort()).toEqual(collectKeys(en).sort());
  });

  it("includes initial settings messages for both languages", () => {
    expect(en.settings.tabs.general).toBe("General");
    expect(zhCN.settings.tabs.general).toBe("通用");
    expect(en.settings.general.languageTitle).toBe("Language");
    expect(zhCN.settings.general.languageTitle).toBe("界面语言");
  });

  it("includes the Phase 2 Settings messages for both languages", () => {
    expect(en.settings.general.appearance.system).toBe("System");
    expect(zhCN.settings.general.appearance.system).toBe("跟随系统");
    expect(en.settings.general.language.description).toContain("UI language");
    expect(zhCN.settings.general.language.description).toContain("界面语言");
    expect(en.settings.themes.editorTheme.title).toBe("Editor theme");
    expect(zhCN.settings.themes.editorTheme.title).toBe("编辑器主题");
    expect(en.settings.shortcuts.searchPlaceholder).toBe("Search shortcuts...");
    expect(zhCN.settings.shortcuts.searchPlaceholder).toBe("搜索快捷键...");
    expect(en.settings.models.providers.emptyTitle).toBe(
      "No providers connected yet.",
    );
    expect(zhCN.settings.models.providers.emptyTitle).toBe(
      "还没有连接模型提供商。",
    );
    expect(en.settings.agents.snippets.new).toBe("New snippet");
    expect(zhCN.settings.agents.snippets.new).toBe("新建片段");
    expect(en.settings.about.actions.viewOnGitHub).toBe("View on GitHub");
    expect(zhCN.settings.about.actions.viewOnGitHub).toBe("在 GitHub 查看");
    expect(en.settings.general.terminal.cursor.shapes.bar).toBe("Bar");
    expect(zhCN.settings.general.terminal.cursor.shapes.bar).toBe("竖线");
    expect(en.settings.general.terminal.cursor.animation).toBe("Style");
    expect(zhCN.settings.general.terminal.cursor.animation).toBe("样式");
    expect(en.settings.general.terminal.cursor.animations.expand).toBe(
      "Expand",
    );
    expect(zhCN.settings.general.terminal.cursor.animations.expand).toBe(
      "伸缩",
    );
    expect(en.settings.general.terminal.cursor.preview).toBe("Cursor preview");
    expect(zhCN.settings.general.terminal.cursor.preview).toBe("光标预览");
    expect(
      en.settings.general.terminal.cursor.animationDescriptions.expand,
    ).toContain("center");
    expect(
      zhCN.settings.general.terminal.cursor.animationDescriptions.expand,
    ).toContain("中心");
  });

  it("includes the Phase 3 main shell messages for both languages", () => {
    const enShell = (en as { mainShell?: Record<string, unknown> }).mainShell;
    const zhShell = (zhCN as { mainShell?: Record<string, unknown> }).mainShell;

    expect(enShell).toBeTruthy();
    expect(zhShell).toBeTruthy();
    expect(enShell?.header).toBeTruthy();
    expect(zhShell?.header).toBeTruthy();
    expect(enShell?.commandPalette).toBeTruthy();
    expect(zhShell?.commandPalette).toBeTruthy();
    expect(enShell?.closeDialogs).toBeTruthy();
    expect(zhShell?.closeDialogs).toBeTruthy();
  });

  it("includes the Phase 4 workspace module messages for both languages", () => {
    const enWorkspace = (en as { workspace?: Record<string, unknown> })
      .workspace;
    const zhWorkspace = (zhCN as { workspace?: Record<string, unknown> })
      .workspace;

    expect(enWorkspace?.explorer).toBeTruthy();
    expect(zhWorkspace?.explorer).toBeTruthy();
    expect(enWorkspace?.sourceControl).toBeTruthy();
    expect(zhWorkspace?.sourceControl).toBeTruthy();
    expect(enWorkspace?.gitHistory).toBeTruthy();
    expect(zhWorkspace?.gitHistory).toBeTruthy();
    expect(enWorkspace?.editor).toBeTruthy();
    expect(zhWorkspace?.editor).toBeTruthy();
    expect(enWorkspace?.preview).toBeTruthy();
    expect(zhWorkspace?.preview).toBeTruthy();
    expect(enWorkspace?.markdown).toBeTruthy();
    expect(zhWorkspace?.markdown).toBeTruthy();
  });

  it("includes the Phase 5 AI surface messages for both languages", () => {
    const enAi = (en as { ai?: Record<string, unknown> }).ai;
    const zhAi = (zhCN as { ai?: Record<string, unknown> }).ai;

    expect(enAi?.chat).toBeTruthy();
    expect(zhAi?.chat).toBeTruthy();
    expect(enAi?.approval).toBeTruthy();
    expect(zhAi?.approval).toBeTruthy();
    expect(enAi?.planDiff).toBeTruthy();
    expect(zhAi?.planDiff).toBeTruthy();
    expect(enAi?.pickers).toBeTruthy();
    expect(zhAi?.pickers).toBeTruthy();
    expect(enAi?.notifications).toBeTruthy();
    expect(zhAi?.notifications).toBeTruthy();
  });

  it("includes the Phase 6 polish messages for edge UI surfaces", () => {
    expect(en.mainShell.spaces.title).toBe("Spaces");
    expect(zhCN.mainShell.spaces.title).toBe("空间");
    expect(en.mainShell.terminalBlocks.runAgain).toBe("Run again");
    expect(zhCN.mainShell.terminalBlocks.runAgain).toBe("重新运行");
    expect(en.mainShell.workspaceSwitcher.saveOrCloseUnsavedEditors).toContain(
      "unsaved editor tabs",
    );
    expect(zhCN.mainShell.workspaceSwitcher.saveOrCloseUnsavedEditors).toContain(
      "未保存",
    );
    expect(en.workspace.editor.saveToPreview).toBe("Save to preview");
    expect(zhCN.workspace.editor.saveToPreview).toBe("保存后预览");
    expect(en.ai.mini.untitledSession).toBe("New chat");
    expect(zhCN.ai.mini.untitledSession).toBe("新聊天");
  });
});

describe("locale-aware formatting", () => {
  it("formats standard numbers by locale", () => {
    expect(formatNumber("en", 25000)).toBe("25,000");
    expect(formatNumber("zh-CN", 25000)).toBe("25,000");
  });

  it("formats compact numbers by locale", () => {
    expect(formatCompactNumber("en", 1200)).toBe("1.2K");
    expect(formatCompactNumber("zh-CN", 12000)).toBe("1.2万");
  });

  it("formats percentages by locale", () => {
    expect(formatPercent("en", 0.42)).toBe("42%");
    expect(formatPercent("zh-CN", 0.42)).toBe("42%");
  });
});

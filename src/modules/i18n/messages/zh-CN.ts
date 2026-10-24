export const zhCN = {
  common: {
    cancel: "取消",
    copied: "已复制",
    startingShell: "正在启动 shell",
    dropFileHint: "把文件路径拖到这里",
  },
  mainShell: {
    header: {
      settings: "设置",
      commandPalette: "命令面板",
    },
    tabs: {
      closeTab: "关闭标签",
      renameTab: "重命名标签",
      rename: "重命名",
      close: "关闭",
      newTab: "新建标签",
    },
    commandPalette: {
      title: "命令面板",
      description: "运行命令或切换主题。",
      placeholders: {
        themes: "搜索主题...",
        commands: "输入命令或关键词",
      },
      groups: {
        General: "通用",
        Tabs: "标签",
        Panes: "窗格",
      },
      commands: {
        openSettings: {
          title: "打开设置",
          keywords: ["偏好", "配置"],
        },
        changeTheme: {
          title: "更改主题...",
          keywords: ["主题", "外观", "颜色", "深色", "浅色"],
        },
        keyboardShortcuts: {
          title: "键盘快捷键",
          keywords: ["按键", "快捷键", "设置"],
        },
        newTerminal: {
          title: "新建终端",
          keywords: ["shell", "终端", "新建标签"],
        },
        closeTabOrPane: {
          title: "关闭标签或窗格",
          keywords: ["关闭", "移除", "窗格"],
        },
        splitPaneRight: {
          title: "向右拆分窗格",
          keywords: ["终端", "窗格", "拆分", "右侧", "列"],
        },
        splitPaneDown: {
          title: "向下拆分窗格",
          keywords: ["终端", "窗格", "拆分", "下方", "行"],
        },
      },
      disabled: {
        noTerminalTab: "没有终端标签",
        paneLimit: "窗格已达上限",
        lastTab: "最后一个标签",
      },
      headings: {
        themes: "主题",
      },
      status: {
        noThemes: "没有主题",
        typeAtLeast2Characters: "至少输入 2 个字符",
        noMatches: "没有匹配项",
        noCommandsFound: "没有找到命令。输入关键词继续筛选。",
      },
      back: "返回",
    },
    closeDialogs: {
      closeTerminalTitle: "关闭终端？",
      terminalProcessDescription: "有进程正在运行。关闭此标签会终止它。",
      closeAnyway: "仍要关闭",
    },
  },
  settings: {
    tabs: {
      general: "通用",
      themes: "主题",
      shortcuts: "快捷键",
      about: "关于",
    },
    general: {
      title: "通用",
      appearance: {
        title: "外观",
        system: "跟随系统",
        light: "浅色",
        dark: "深色",
      },
      zoom: {
        title: "缩放",
        uiZoomLevel: "界面缩放比例",
      },
      terminal: {
        title: "终端",
        useWebgl: "使用 WebGL 渲染器",
        fontFamily: "字体族",
        codeFontFamily: "代码字体",
        codeFontFamilyPlaceholder: "Kite Mono",
        cjkFontFamily: "中文字体",
        cjkFontFamilyPlaceholder: "Kite Sans SC",
        fontFamilyUnmatched:
          "未匹配到字体名，终端会改用自带字体。请填写字体族名，不要带字重或斜体后缀。",
        fontCjkMisaligned:
          "中文字体与代码字体的宽度比不是 2:1，汉字周围会有空隙或错位。",
        fontCjkFix: (name: string) => `代码与中文字体都改用 ${name}`,
        fontWeight: "字体粗细",
        fontWeights: {
          normal: "常规",
          medium: "中等",
          semiBold: "半粗体",
          bold: "粗体",
        },
        shell: "集成终端 Shell",
        autoShell: "自动",
        letterSpacing: "字距",
        fontSize: "字体大小",
        scrollback: "回滚行数",
        scrollbackLines: (lines: number) => `${lines} 行`,
      },
      startup: {
        title: "启动",
        restoreWindow: "恢复窗口位置和大小",
      },
    },
    themes: {
      title: "主题",
      theme: {
        title: "主题",
        importTheme: "导入 .kite-theme",
        failedToRead: "读取失败",
        removeTheme: (name: string) => `移除 ${name}`,
        removeThemeConfirm: "此操作无法撤销。",
        cancel: "取消",
        remove: "移除",
      },
    },
    shortcuts: {
      title: "快捷键",
      resetAll: "全部重置",
      searchPlaceholder: "搜索快捷键...",
      unassigned: "未分配",
      resetToDefault: "恢复默认",
      clearShortcut: "清除快捷键",
      recording: "录制中...",
      escToCancel: "（Esc 取消）",
      conflict: (action: string) => `该快捷键已分配给「${action}」`,
      resetDialogTitle: "重置所有快捷键？",
      resetDialogDescription:
        "这会把所有自定义键盘快捷键恢复为出厂默认值，此操作无法撤销。",
      groups: {
        General: "通用",
        Tabs: "标签",
        Panes: "窗格",
        Terminal: "终端",
        View: "视图",
      },
      actions: {
        "commandPalette.open": "打开命令面板",
        "settings.open": "打开设置",
        "tab.new": "新建标签",
        "tab.close": "关闭标签或窗格",
        "pane.splitRight": "向右拆分窗格",
        "pane.splitDown": "向下拆分窗格",
        "pane.focusNext": "聚焦下一个窗格",
        "pane.focusPrev": "聚焦上一个窗格",
        "terminal.clear": "清空终端",
        "tab.next": "下一个标签",
        "tab.prev": "上一个标签",
        "tab.selectByIndex": "跳转到标签 1-9",
        "view.zoomIn": "放大",
        "view.zoomOut": "缩小",
        "view.zoomReset": "重置缩放",
        "view.zenMode": "切换专注模式",
      },
    },
    about: {
      title: "关于",
      build: "构建",
      bundleId: "Bundle ID",
      license: "许可证",
      sourceCode: "源代码",
      actions: {
        viewOnGitHub: "在 GitHub 查看",
        reportIssue: "报告问题",
      },
    },
  },
};

export type Messages = typeof zhCN;

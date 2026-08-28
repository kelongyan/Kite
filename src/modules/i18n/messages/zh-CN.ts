export const zhCN = {
  common: {
    cancel: "取消",
  },
  mainShell: {
    header: {
      settings: "设置",
      toggleSidebar: "切换侧边栏",
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
        View: "视图",
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
        toggleFileExplorer: {
          title: "切换文件资源管理器",
          keywords: ["侧边栏", "文件", "资源管理器"],
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
        noWorkspaceRoot: "没有工作区根目录",
        typeAtLeast2Characters: "至少输入 2 个字符",
        noMatches: "没有匹配项",
        noCommandsFound: "没有找到命令。输入关键词继续筛选。",
      },
      back: "返回",
    },
    statusbar: {
      cwd: {
        noDirectory: "无目录",
        home: "主目录",
        loading: "加载中...",
        noSubfolders: "没有子文件夹",
        showParentFolders: "显示上级文件夹",
      },
      workspaceEnv: {
        title: "工作区环境",
        windowsLocal: "Windows 本地",
        loadingWslDistros: "正在加载 WSL 发行版...",
        wslUnavailable: "WSL 不可用",
        noWslDistros: "未找到 WSL 发行版",
        refresh: "刷新",
      },
    },
    closeDialogs: {
      closeTerminalTitle: "关闭终端？",
      terminalProcessDescription: "有进程正在运行。关闭此标签会终止它。",
      closeAnyway: "仍要关闭",
    },
  },
  workspace: {
    explorer: {
      noCurrentDirectory: "没有当前目录",
      loading: "加载中...",
      refresh: "刷新",
      openInTerminal: "在终端中打开",
      revealInFinder: "在 Finder 中显示",
      revealInFileManager: "在文件管理器中显示",
      copyPath: "复制路径",
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
      description: "外观、终端和窗口行为。",
      appearance: {
        title: "外观",
        system: "跟随系统",
        light: "浅色",
        dark: "深色",
        themesHint: "主题请前往",
        themesTab: "主题",
        themesHintSuffix: "标签页。",
      },
      zoom: {
        title: "缩放",
        uiZoomLevel: "界面缩放比例",
      },
      explorer: {
        title: "资源管理器",
        showHiddenFiles: "显示隐藏文件",
        showHiddenFilesDescription:
          "在文件资源管理器中包含以点开头的文件和文件夹（.env、.gitignore、.config）。",
      },
      terminal: {
        title: "终端",
        useWebgl: "使用 WebGL 渲染器",
        webglAria: "查看 WebGL 渲染器说明",
        webglTooltip:
          "xterm 的 WebGL 渲染器会把字形缓存到 GPU 纹理图集中。部分 macOS 环境下图集可能损坏，导致终端文字不可读。关闭后会回退到 DOM 渲染。CJK 字体回退在 WebGL 下也可能产生显示异常。",
        webglDescription:
          "硬件加速渲染。文字出现损坏、空白块或 CJK 对齐异常时可关闭。",
        fontFamily: "字体族",
        fontFamilyPlaceholder:
          "例如 JetBrains Mono, 'Microsoft YaHei', monospace",
        fontWeight: "字体粗细",
        fontWeightDescription: "终端字符的粗细。",
        fontWeights: {
          normal: "常规",
          medium: "中等",
          semiBold: "半粗体",
          bold: "粗体",
        },
        shell: "集成终端 Shell",
        shellUnavailableDescription: "此 Shell 不支持目录跟踪。",
        shellWithWslDescription:
          "集成终端使用的 Shell。WSL 工作区会使用发行版默认 Shell。已打开的标签保持原 Shell。",
        shellDescription: "新终端标签使用的 Shell。已打开的标签保持原 Shell。",
        autoShell: "自动",
        workspaceEnvironment: "工作区环境",
        workspaceEnvironmentDescription:
          "新终端运行的位置：Windows 或 WSL 发行版。已打开的标签保持原环境，可在状态栏切换。",
        unavailable: "不可用",
        letterSpacing: "字距",
        letterSpacingDescription:
          "字符之间的额外横向间距（px）。负值可收紧 Nerd Fonts。",
        fontSize: "字体大小",
        fontSizeDescription: "终端文字大小。",
        scrollback: "回滚行数",
        scrollbackDescription:
          "每个终端保留的历史行数。数值越高占用内存越多（约 3 KB / 行）。",
        scrollbackLines: (lines: number) => `${lines} 行`,
      },
      startup: {
        title: "启动",
        restoreWindow: "恢复窗口位置和大小",
        restoreWindowDescription:
          "下次启动时回到上次关闭前的主窗口位置和大小。",
      },
    },
    themes: {
      title: "主题",
      description: "应用主题。",
      theme: {
        title: "主题",
        importTheme: "导入 .kite-theme",
        failedToRead: "读取失败",
        removeTheme: (name: string) => `移除 ${name}`,
      },
    },
    shortcuts: {
      title: "快捷键",
      description: "查看和自定义键盘快捷键。",
      resetAll: "全部重置",
      searchPlaceholder: "搜索快捷键...",
      unassigned: "未分配",
      resetToDefault: "恢复默认",
      clearShortcut: "清除快捷键",
      recording: "录制中...",
      escToCancel: "（Esc 取消）",
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
        "sidebar.toggle": "切换文件资源管理器",
        "explorer.focus": "切换文件资源管理器焦点",
        "view.zoomIn": "放大",
        "view.zoomOut": "缩小",
        "view.zoomReset": "重置缩放",
        "view.zenMode": "切换专注模式",
      },
    },
    about: {
      title: "关于",
      tagline: "开源桌面终端模拟器",
      build: "构建",
      bundleId: "Bundle ID",
      license: "许可证",
      sourceCode: "源代码",
      projectPage: "项目页面",
      updatesDisabled: "更新已禁用",
      updateChecksDisabled: "此个人 fork 已禁用更新检查。",
      actions: {
        viewOnGitHub: "在 GitHub 查看",
        reportIssue: "报告问题",
      },
    },
  },
};

export type Messages = typeof zhCN;

# Kite 功能瘦身建议

生成时间: 2026-07-30

目标: 将 Kite 从现在的“终端优先桌面开发工作台”，收束为“极简且高度自定义的终端工具”，优先追求启动快、交互快、维护成本低、功能边界清楚。

本文只做分析和建议，不删除代码。后续真正开删时，建议按本文的优先级逐块处理。

## 阶段 1 完成记录

2026-07-30，阶段 1 已落地的部分:

- 已移除 Blocks 终端入口和相关快捷键。
- 已收缩命令面板，去掉内容搜索和命令历史模式。
- 已保留 SFTP、Git、编辑器和 Markdown 预览。
- 已删除主题页里的背景图、透明度和模糊设置，保留主题与编辑器配色。
- 已将主界面入口收紧到终端、SFTP、Git、编辑器和核心命令。

2026-07-30，背景图片与透明度链路已彻底移除：

- 前端设置页不再提供背景图、透明度或模糊入口。
- 主题层背景图叠加、图片持久化和终端联动已清空。
- 相关旧配置键会在加载时自动清理。

2026-07-30，Blocks 已彻底移除：

- 前端 Blocks UI、输入栏和相关状态已删除。
- PTY / shell 集成中的 `KITE_BLOCKS` 分支已删除。
- 相关文案、测试和后台支持代码已清空。

2026-07-30，Git 图谱已彻底移除：

- 前端 `git-history` 模块、提交图谱入口和历史提交文件 diff tab 已删除。
- 命令面板、标签新建菜单和 Source Control 面板不再提供 Git 图谱入口。
- 后端 `git_log`、`git_commit_files`、`git_commit_file_diff`、`git_remote_url` IPC 链路已清空。
- 保留 Source Control 的状态、暂存、提交、fetch、pull、push、分支切换和当前工作区 diff。

2026-07-31，Explorer 已收缩为轻量目录导航器：

- 前端文件搜索、新建、重命名、删除、拖拽移动、外部复制和 Git 标记已删除。
- Explorer 只保留当前目录树、键盘导航、打开文件、目录打开到终端、复制路径、系统文件管理器显示和手动刷新。
- 后端 `fs_search`、`fs_grep_interactive`、`fs_watch_add`、`fs_watch_remove`、`fs_rename`、`fs_copy` IPC 链路已清空。
- Rust 依赖 `notify`、`ignore`、`nucleo-matcher`、`grep-regex`、`grep-searcher` 已移除。
- 保留 `fs_read_dir`、`fs_read_file`、`fs_write_file`、`fs_stat`、`fs_canonicalize`、`fs_create_file`、`fs_create_dir`、`fs_delete`，用于轻导航、编辑器和自定义主题。

## 结论先行

建议新版产品边界:

- 必须保留: 原生 PTY、xterm 渲染、多标签、分屏、终端搜索、链接识别、shell 集成、Windows 进程树清理、Workspace 授权、WSL 支持、SFTP、Git 工作流、内置编辑器和 Markdown 预览、快捷键、命令面板核心、基础主题和终端字体设置。
- 第一优先级删除: 文件资源管理器的重功能、Blocks 终端、背景图、过量主题、低频设置项。Explorer 重功能、Blocks、背景图已完成。
- 第二优先级收缩: 内容搜索、文件监听、应用级命令历史，以及 Explorer 中的文件操作快捷入口。内容搜索、文件监听和 Explorer 文件操作已完成。
- 第三优先级精简: 仅保留少量高质量主题和必要的终端视觉设置。

如果目标是“极简但仍保留实用协作能力”，我推荐路线是:

1. 先砍掉 Explorer 的重功能。
2. 再收掉 Blocks 和低频历史能力。
3. 最后压缩主题、背景图和设置页。
4. SFTP、Git 和编辑器保持为按需打开的稳定工作区，不动主链路。

这条路线收益最大，也最符合“极简且极速”的目标。

## 当前功能盘点

Kite 当前不是单纯终端，而是一个桌面开发工作台。现有主功能包括:

- 终端: 多标签、分屏、xterm WebGL、搜索、链接、OSC 7 cwd 跟踪、OSC 133 命令边界、后台输出、文件拖拽。
- 工作区: 本地和 WSL 环境切换、启动目录解析、workspace 授权。
- 文件: 轻量目录树、键盘导航、打开文件、目录打开到终端、复制路径、系统文件管理器显示、手动刷新、隐藏文件开关。
- 编辑器: CodeMirror 编辑、语言高亮、Vim 模式、自动保存、媒体/PDF 预览、Git diff 视图。
- Markdown: 渲染预览和原文切换。
- Git: 状态面板、暂存、取消暂存、丢弃、提交、fetch、pull、push、分支列表/切换、当前工作区单文件 diff。
- SFTP: 连接配置、SSH config 模板、凭据存储、主机指纹确认、本地/远程双栏、上传下载、批量传输、冲突处理、同步预览。
- 个性化: 应用主题、自定义主题、编辑器主题、终端字体、字号、字重、字距、回滚行数、WebGL 开关、快捷键自定义、窗口状态恢复、缩放、专注模式。

## 证据摘要

前端模块体量，按 `src/modules` 统计:

| 模块 | 文件数 | 代码行数 | 判断 |
| --- | ---: | ---: | --- |
| terminal | 51 | 8153 | 核心，不能粗暴删 |
| explorer | 19 | 5712 | 大，且很多能力偏 IDE |
| sftp | 21 | 2829 | 保留，远程文件传输和协作的稳定工作区 |
| source-control | 6 | 2620 | 保留，Git 工作流的图形化补充 |
| editor | 20 | 2362 | 保留，轻编辑和预览能力 |
| theme | 28 | 2305 | 符合自定义目标，但可以收缩 |
| command-palette | 14 | 1153 | 符合快捷目标，建议保留核心 |
| markdown | 5 | 192 | 保留，轻量预览能力 |

后端模块体量，按 `src-tauri/src/modules` 统计:

| 模块 | 文件数 | 代码行数 | 判断 |
| --- | ---: | ---: | --- |
| pty | 12 | 2538 | 核心 |
| git | 8 | 2525 | Git UI 绑定，删除收益高 |
| sftp | 8 | 2494 | SFTP 绑定，删除收益高 |
| fs | 7 | 1528 | 文件树/编辑器/搜索绑定，可大幅收缩 |
| history | 2 | 486 | Blocks/命令历史绑定，可随 Blocks 删除 |

Tauri command 数量:

| 分组 | command 数 | 判断 |
| --- | ---: | --- |
| git | 17 | 可整组删除 |
| sftp | 16 | 可整组删除 |
| fs | 15 | 取决于是否保留文件树/编辑器 |
| pty | 8 | 核心 |
| history | 4 | 可随 Blocks 删除 |
| workspace | 4 | 建议保留 |
| app | 2 | 启动目录和设置窗口，成本低 |

静态入口图:

- `pnpm analyze:eager` 显示主窗口 eager local modules 为 178 个，设置窗口为 56 个。
- 被监控的重包中，主窗口 eager 图只命中 `@xterm`，说明 CodeMirror 和 streamdown 已经有懒加载边界。
- 自定义入口图统计显示，主窗口静态可达的本地模块里包含 `sftp` 14 个、`explorer` 18 个、`theme` 26 个、`terminal` 29 个。SFTP 目前通过 `src/modules/sftp/index.ts` 直接导出 `SftpTransferStack`，不是 lazy stack。

依赖归属:

- SFTP 绑定 `ssh2`、`keyring`、`base64`，同时带来凭据、主机指纹、远程文件删除和传输安全边界。
- 文件树和搜索绑定 `notify`、`ignore`、`nucleo-matcher`、`grep-regex`、`grep-searcher`。
- 编辑器绑定 CodeMirror、UIW CodeMirror、Vim、多个语言包和编辑器主题。
- Markdown 绑定 `streamdown`。
- Git UI 绑定 Rust Git 命令、source-control 面板、git-diff tab 和部分 explorer Git decoration。

## 优先删除建议

### P1: 保留 SFTP

建议: 保留，作为可选工作区，不要删除。

原因:

- 这部分对有远程服务器、远程文件同步和批量传输需求的人很实用。
- 它已经和凭据、主机指纹、冲突处理、同步预览连成完整链路，删掉会损失一整套稳定能力。
- 如果未来还想收缩，优先考虑降级入口，不要动核心能力。

主要影响文件:

- `src/modules/sftp/**`
- `src-tauri/src/modules/sftp/**`
- `src-tauri/src/modules/secrets.rs`
- `src/app/App.tsx`
- `src/app/components/WorkspaceSurface.tsx`
- `src/modules/tabs/lib/useTabs.ts`
- `src/modules/command-palette/commands.ts`
- `src/modules/i18n/messages/zh-CN.ts`
- `package.json`
- `src-tauri/Cargo.toml`
- `src-tauri/src/lib.rs`

### P1: 保留内置 Git UI，删除 Git 图谱

建议: 保留 Source Control 主流程，删除 Git 图谱和历史提交浏览。

原因:

- Git 是高频需求，图形化面板能显著降低 staging、commit、diff、fetch、pull 和 push 的摩擦。
- 提交历史图属于低频增强，入口和后端命令链路独立，删除后不影响当前改动的提交工作流。
- 当前极简边界保留“正在改什么”和“如何提交同步”，不保留“历史提交浏览”。

主要影响文件:

- `src/modules/source-control/**`
- `src/modules/editor/GitDiffPane.tsx`
- `src/modules/editor/GitDiffStack.tsx`
- `src-tauri/src/modules/git/**`
- `src/lib/native.ts`
- `src/modules/sidebar/**`
- `src/modules/tabs/lib/useTabs.ts`
- `src/app/App.tsx`
- `src/app/components/WorkspaceSurface.tsx`
- `src/modules/i18n/messages/zh-CN.ts`

注意:

- 后续如果还想进一步简化，建议只收拢 Git decoration 和少量低频入口，不要删除 Source Control 主流程。

### P1: 保留内置编辑器和 Markdown 预览

建议: 保留，作为终端工作流的轻编辑和快速查看能力。

原因:

- 编辑器和 Markdown 预览让 Kite 不只是能跑命令，也能快速改文件、看配置和检查文本。
- 这块和终端联动很自然，尤其是打开配置、查看日志、改脚本、补几行代码的时候很顺手。
- 如果未来还要瘦身，优先收缩语言包、主题和低频偏好，不要直接删主能力。

主要影响文件:

- `src/modules/editor/**`
- `src/modules/markdown/**`
- `src/modules/settings/store.ts` 中 editor 相关偏好
- `src/settings/sections/GeneralSection.tsx` 中 editor 设置
- `src/settings/sections/ThemesSection.tsx` 中 editor theme 设置
- `src/app/App.tsx`
- `src/app/components/WorkspaceSurface.tsx`
- `src/modules/tabs/lib/useTabs.ts`
- `src/modules/i18n/messages/zh-CN.ts`
- CodeMirror、UIW theme、Vim、streamdown 相关依赖

### P2: 收缩文件资源管理器（已完成）

建议: 已完成。Explorer 已从“IDE 文件管理器”收缩成“终端目录导航器”。

当前文件树能力偏重:

- 文件树、虚拟列表、图标映射、键盘导航。
- 文件创建、重命名、删除、复制、拖拽移动。
- 文件搜索、内容搜索。
- 文件监听和编辑器同步。
- 隐藏文件、Git ignore、Git status 标记。

已保留的轻量版:

- 当前 cwd 展示。
- 上级目录、子目录浏览。
- 选择目录后 `cd` 到当前终端或新建终端。
- 复制路径。

已删除的部分:

- 内容搜索 `fs_grep_interactive`。
- 文件名模糊搜索 `fs_search`，除非你把它做成命令面板核心能力。
- 文件监听 `fs_watch_add`、`fs_watch_remove`。
- 文件创建、删除、重命名、拖拽移动。
- 大型 file icon / folder icon 映射。
- Git ignored 和 Git status 标记。

收益:

- 前端 `explorer` 约 5712 行，后端 `fs` 约 1528 行。
- 可减少 `notify`、`ignore`、`nucleo-matcher`、`grep-regex`、`grep-searcher` 的必要性。
- UI 从工作台回到终端辅助导航。

### P2: 删除 Blocks 终端

建议: 如果 Blocks 不是核心卖点，删除。

原因:

- 普通终端已经满足大多数场景，Blocks 属于 Warp 风格增强，不是极简基础能力。
- Blocks 引入 ShellInput、命令块渲染、命令边界处理、历史建议、路径补全、命令块导航等复杂逻辑。
- Blocks 使用 CodeMirror 相关能力作为输入层，也会让这套依赖持续存在。
- 后端 `history` 4 个 command 基本为 Blocks 和命令历史服务，可随之删除。

主要影响文件:

- `src/modules/terminal/block/**`
- `src/modules/terminal/block.css`
- `src/app/components/WorkspaceInputBar.tsx`
- `src/modules/tabs/lib/useTabs.ts` 中 `blocks` tab 分支
- `src/modules/shortcuts/shortcuts.ts` 中 Blocks 快捷键
- `src-tauri/src/modules/history/**`
- `src-tauri/src/lib.rs` 中 history state 和 commands

保留前提:

- 如果你希望 Kite 有一个明显区别于普通终端的招牌交互，Blocks 可以暂留。
- 如果第一目标是极速、轻、少维护，建议删除。

### P2: 收缩命令面板

建议: 保留“命令入口”，删除“搜索引擎化”的部分。

保留:

- 新建终端。
- 分屏。
- 切换主题。
- 打开设置。
- 搜索当前终端。
- 快速执行核心命令。

删除或延后:

- 内容搜索模式 `#`。
- 命令历史搜索模式 `>`，如果 Blocks/history 被删除。
- 其余低频、重复度高的功能入口。

理由:

- 命令面板符合“极速快捷”，不该整块删。
- 但它不应该成为 IDE 的搜索中心，否则会拖住 fs grep、history、editor 等链路。

### P3: 精简主题、背景图和视觉设置

建议: 保留基础高度自定义，删除低频视觉花活。

保留:

- 明暗模式。
- 3 到 5 个高质量内置主题。
- 自定义主题导入，若这是你想保留的核心差异点。
- 终端字体族、字号、字重、scrollback、WebGL 开关。

删除或隐藏:

- 背景图导入、背景透明度、背景模糊。
- 过多内置主题。
- 过于细碎的视觉开关。

理由:

- “高度自定义”适合保留，但应该围绕终端体验，不围绕编辑器和装饰背景。
- 背景图会增加渲染、可读性和设置复杂度，对极速工具帮助不大。

### P3: 精简设置窗口

建议: 保留设置窗口，但减少选项。

保留:

- Terminal。
- Appearance。
- Shortcuts。
- About。
- Editor 的少量基础偏好和 SFTP/Git 的专属入口，如果确实需要全局入口。

删除或合并:

- Background image 设置。
- 过于细碎的主题选项。

理由:

- 设置窗口本身成本不高。
- 对“高度自定义”来说，快捷键和终端设置很重要。
- SFTP/Git/Editor 既然要保留，就别把它们的完整工作流再塞进全局设置页。

## 不建议删除的东西

以下内容看起来复杂，但属于终端核心或安全底线，不建议为了短期瘦身删除:

| 能力 | 原因 |
| --- | --- |
| PTY spawn、resize、write、close | 终端本体 |
| shell integration scripts | cwd 跟踪、命令边界、体验稳定性 |
| Windows Job Object | 防止子进程在 Kite 关闭后残留 |
| Windows `SPAWN_LOCK` | 当前说明中明确提到移除可能导致并发 ConPTY 卡住 |
| Workspace 授权 | 文件、Git、SFTP、进程边界的安全基础 |
| WSL 支持 | 对 Windows 开发者价值高，且是终端工具核心场景 |
| xterm 渲染池 | 当前最大核心复杂度，但也是性能基础 |
| 快捷键自定义 | 直接服务“极速快捷” |
| 命令面板核心 | 直接服务“极速快捷” |
| Tauri 基础插件 | `store`、`dialog`、`opener`、`os`、`window-state` 是实现能力，不是产品插件系统 |

## 推荐删减路线

### 阶段 1: 收缩界面噪音

目标: 先让主界面更轻。

建议任务:

1. 删除 Explorer 的重功能和低频文件操作。
2. 删除 Blocks 终端和 app-level history commands。
3. 删除内容搜索、文件监听和大图标映射。
4. 精简背景图和过多主题。
5. 运行 `pnpm check-types`、`pnpm test`、`pnpm build`、`pnpm analyze:eager`、`cargo check --all-targets --locked`。

### 阶段 2: 保留协作工作区，但降级入口

目标: SFTP、Git、编辑器继续保留，但不抢首页。

建议任务:

1. 保留 SFTP、Git 和编辑器作为按需打开的工作区。
2. 收拢它们的命令入口和设置入口。
3. 只对语言包、Git decoration、SFTP profiles 这类做细修。
4. 运行前后端检查，重点看 bundle 和 eager graph。

### 阶段 3: 收缩侧栏和搜索

目标: 文件能力只服务终端导航。

建议任务:

1. 把 Explorer 改成轻量目录导航。
2. 删除文件 mutation、watch、drag/drop、Git decoration、大型图标映射。
3. 删除内容搜索和文件名模糊搜索，除非命令面板要保留它们作为核心体验。
4. 清理 `notify`、`ignore`、`nucleo-matcher`、`grep-*`。

### 阶段 4: 删除 Blocks 和低频设置

目标: 进一步减少复杂交互和隐藏依赖。

建议任务:

1. 删除 Blocks 终端。
2. 删除 app-level history commands。
3. 删除背景图、过多内置主题和过于细碎的视觉开关。
4. 设置页只保留终端、外观、快捷键、关于，以及少量保留功能的基础入口。

## 决策矩阵

| 功能 | 推荐动作 | 删除收益 | 用户损失 | 我的建议 |
| --- | --- | --- | --- | --- |
| SFTP | 保留 | 高 | 无 | 保留为按需工作区 |
| Git UI | 保留 | 高 | 无 | 保留为图形化补充 |
| Git 图谱 | 删除 | 中 | 失去提交历史图 | 已删除，保留 Source Control |
| 编辑器 | 保留 | 高 | 无 | 保留为轻编辑和查看 |
| Markdown | 保留 | 中 | 无 | 保留为轻量预览 |
| Explorer | 收缩 | 很高 | 失去完整文件管理 | 已降级目录导航 |
| 内容搜索 | 删除 | 中高 | 失去项目内 grep UI | 已删除，用 rg CLI |
| Blocks | 删除或保留招牌 | 中 | 失去命令块体验 | 追求极简就删 |
| 命令面板 | 保留核心 | 中 | 无 | 保留，删非核心命令 |
| 快捷键自定义 | 保留 | 低 | 无 | 保留 |
| 主题系统 | 精简 | 中 | 可选主题减少 | 保留自定义，删背景图 |
| WSL | 保留 | 低到中 | Windows 用户损失大 | 保留 |
| WebGL 开关 | 保留 | 低 | 故障排查变差 | 保留 |

## 最终推荐版本形态

我建议极简版 Kite 长这样:

- 主界面以终端为主，但 SFTP、Git 和编辑器保留为按需打开的工作区，不占首页主位。
- 左侧栏默认收缩，必要时再展开为轻量 cwd navigator 或协作视图。
- 默认只有普通终端 tab，支持多标签和分屏。
- 命令面板只放核心命令: 新建终端、分屏、查找、主题、设置、快捷键。
- 设置只保留: 终端字体、字号、字重、scrollback、WebGL、shell、WSL 默认环境、主题、快捷键、窗口状态。
- 文件编辑、Git、SFTP、Markdown 保留为按需打开的工作区，低频操作优先走它们自己的入口。

这会让 Kite 从“轻量开发工作台”收束成“终端优先、但保留实用协作能力”的工具。龙哥要的是一把快刀，不是瑞士军刀，但快刀也得能切对东西。

## 本次验证记录

本次为分析文档任务，没有改业务代码，未运行完整构建。已执行的验证和取证:

- `git status --short`: 确认当前已有未提交代码改动，本次只新增文档。
- `rg --files` 和模块目录扫描: 确认前后端功能分布。
- PowerShell 行数统计: 得到前端/后端模块代码量。
- Tauri command 注册解析: 得到 command 分组数量。
- `pnpm analyze:eager`: 通过，主窗口 eager graph 178 个 local modules，设置窗口 56 个 local modules。
- 依赖归属检索: 确认 SFTP、Git、FS 搜索、Editor、Markdown 对应依赖链。

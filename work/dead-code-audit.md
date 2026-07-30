# Kite 删除功能残留与死代码审计

审计基线：`0810751`（`main`）
重点提交：`485c75e refactor: remove AI, spaces, web preview, english locale and private terminal features`
首次审计：2026-07-29
Rust 专项复审：2026-07-29（当前工作树）
全库复核：2026-07-29（包含当前未提交改动）

## 实施进度

- [x] 阶段 1：修复 SFTP 凭据存取并补充安全测试
- [x] 阶段 2：清理 AI、Agent、Spaces、locale 前端残留与启动入口
- [x] 阶段 3：删除无消费者 Tauri command、Rust 子系统及专属测试
- [x] 阶段 4：删除孤立依赖、插件、权限并更新 lockfile
- [x] 阶段 5：删除不可达文件、自引用测试模块和无消费者 wrapper
- [x] 阶段 6：收口未使用导出与 barrel 公共面
- [x] 阶段 7：清理构建配置、CSS、fixture、文档和资产
- [x] 阶段 8：全量门禁、反向审计并确认代码库清洁状态

阶段 1 完成记录（2026-07-29）：恢复 SFTP 凭据真实后端；Windows/macOS 使用系统凭据库，Linux 使用应用数据目录下 `0600` 权限的原子文件存储。`cargo check --all-targets --locked`、`cargo clippy --all-targets --locked -- -D warnings`、`cargo test --locked --no-run` 均通过。

阶段 2 完成记录（2026-07-29）：删除 Explorer 无效 Agent 菜单、Source Control AI 提交骨架、失效 Agent 事件监听、Blocks AI 提示、Spaces workspace hook 成员和单语言持久化链路；裁剪 AI、Web Preview、Models、Agents、语言及 Spaces 消息树；两个 HTML 入口改为 `zh-CN`，启动主题改为 Kite key 优先并兼容旧 Terax key。`pnpm check-types`、`pnpm test`（39 个文件、228 项测试）和 `pnpm lint` 均通过；lint 保留仓库既有 warning，无 error。

阶段 3 完成记录（2026-07-29）：删除 15 个无真实前端消费者的 Tauri command 链路，包括整个 `shell` 子系统、`fs_list_files`、`fs_grep`、`fs_glob`、`pty_shell_name`、`wsl_default_distro`、`git_diff` 和 `git_show_commit`；同步删除 `ShellState`、`authorize_spawn_cwd`、独占数据类型、前端 Git wrapper 及专属测试，保留现役 `proc.rs`、`shared_child`、`fs_grep_interactive`、`git_diff_content` 和内部 fallback patch helper。`cargo check --all-targets --locked`、`cargo clippy --all-targets --locked -- -D warnings`、`cargo test --locked --no-run` 均通过。

阶段 4 完成记录（2026-07-29）：删除 4 个无消费者前端直接依赖、通知插件前后端依赖及 capability、7 个无消费者 Rust 直接依赖，并移除 macOS 相机和麦克风 usage description / entitlement；使用 `pnpm install --lockfile-only` 与 `cargo update --workspace` 更新两个 lockfile。`@fontsource/jetbrains-mono` 由 `src/styles/fonts.css` 真实引用，Knip 不识别 CSS URL，保留；锁文件中 Radix hook、Zod 等同名包均有现役传递消费者。`pnpm check-types`、`pnpm test`（39 个文件、228 项测试）、`cargo check --all-targets --locked`、`cargo clippy --all-targets --locked -- -D warnings`、`cargo test --locked --no-run` 均通过，plist/XML 与 capability JSON 解析通过。

阶段 5 完成记录（2026-07-29）：删除 19 个不可达前端文件、`outputCap` 与其测试、`pickTabBySpaceIndex` 与其测试、两个 SFTP 自证式局部死实现及测试，并删除 `native.gitCanonicalizeRoot` 与旧 `native.gitPull` wrapper；保留有真实消费者的 `native.canonicalize`、`native.gitPullFfOnly`、`progress.tsx` 和 `tabs.tsx`。取消 UI ignore 的完整 Knip 文件扫描为零不可达文件；`pnpm check-types`、`pnpm test`（37 个文件、222 项测试）和 `cargo check --all-targets --locked` 均通过。

阶段 6 完成记录（2026-07-29）：收窄 theme、explorer、header、shortcuts、sidebar、source-control、tabs、terminal、workspace、command-palette 共 10 个 barrel，取消仅供文件内部使用的 value/type 导出；进一步删除无消费者的语言预加载、终端 readiness/PTY 反查、renderer 辅助 API、Source Control remote indicator 和旧快捷键格式化实现。`pnpm knip --include exports --include types --reporter json` 返回零项，`pnpm check-types` 与 `pnpm test`（37 个文件、222 项测试）通过；默认 Knip 未发现新增不可达文件，剩余 CSS 字体引用误报和配置提示转入阶段 7。

阶段 7 完成记录（2026-07-29）：删除 Vite AI manual chunks、eager graph 旧 watch/fixture、Knip/Biome 失效 ignore、AI registry、两组孤立 CSS 动画和旧测试概念；取消 UI 目录扫描豁免后继续删除 46 个无消费者 shadcn 子导出/局部组件，并删除无 JS 消费者的两个 Tauri 前端插件包。产品元数据、README、ROADMAP、SECURITY、CLAUDE 与 TERAX 已按当前 terminal/Git/SFTP 架构校正，失效 AI 计划及 7 张旧功能/未引用图片已删除，SFTP 计划移除不存在的 AI 链路。CSP 删除任意 `https:` 连接和任意网页 frame 放行；`pnpm tauri dev` 实际启动后应用日志记录 Windows shell 初始化及 `pty opened`，证明 IPC 与首个 PTY 未被阻断。`pnpm lint`（103 个既有 warning、1 个 info、零 error）、`pnpm check-types`、`pnpm test`（37 个文件、222 项测试）、`pnpm build`、`pnpm analyze:eager`、默认 `pnpm knip` 和 `git diff --check` 均通过。

阶段 8 完成记录（2026-07-29）：全量前端门禁通过，默认 Knip 零报告；`cargo-machete 0.9.2` 零未使用依赖；当前 66 个 Tauri command 均在非测试前端代码中有字面量 `invoke()`，孤立注册为零。Rust check、Clippy 和全部测试目标编译通过；实际 `cargo test` 仍在进入测试断言前受本机 Windows `0xc0000139 STATUS_ENTRYPOINT_NOT_FOUND` 阻塞。反向关键词、资产引用、CSP、capability、JSON/XML、manifest、lockfile 和差异格式均完成复核，删除功能仅剩明确记录的兼容或历史边界。

## 结论

8 个阶段已全部完成。按本审计定义和当前工具可见范围，已删除功能的 UI、状态、事件、IPC、Rust 子系统、直接依赖、权限、配置、测试、文案、文档和资产残留已清理完毕。

最终机械指标：

- 默认 `pnpm knip`：零不可达文件、零未使用导出、零未使用类型、零未使用依赖。
- `cargo machete`：零未使用 Rust 直接依赖。
- Tauri command：66 个注册、66 个非测试前端消费者、零孤立注册。
- 原始 1 个高风险、11 个中风险和 18 个低风险问题组均已处理；下文保留修复前证据，便于追溯，不代表当前状态。
- 实际 Rust 测试执行仍受本机 DLL 入口点错误阻塞；Rust check、Clippy 和测试目标编译均已通过，因此该限制不改变死代码审计结论。

## 审计范围与方法

- 对比 `485c75e` 及后续修复 `b822655`，确认 AI、Agents、Spaces、Web Preview、英文 locale 和 private terminal 的删除边界。
- 从 `src/main.tsx`、`src/settings/main.tsx`、Vite 和脚本入口执行默认 Knip 与取消 UI ignore 的完整 Knip。
- 从 `generate_handler!` 提取 command，再逐项对照非测试前端字面量 `invoke()`、`src/lib/native.ts` wrapper 和最终组件消费者。
- 全库搜索功能名称、事件名、文案、配置、依赖、测试、注释、文档和图片资产。
- 检查 GitHub Actions、Nix、Tauri capability、两个 manifest 和 lockfile。
- 执行类型检查、测试、lint、eager graph、生产构建和 size budget。
- 第二轮逐模块复核全部 Rust 源文件、`#[cfg]` 分支、`#[allow(dead_code)]`、测试自证代码、Cargo manifest、Tauri capability、macOS entitlement 和 CSP。
- 第三轮在当前未提交工作树重新运行默认 Knip、前端门禁、Cargo check/clippy/test 编译、`cargo machete`，并机器比对 66 个注册 command 与非测试前端消费者。

项目没有关系型数据库层，因此没有数据库表、索引或 ORM schema 残留可审查。前端设置、主题和背景图使用 Tauri Store、localStorage 与 IndexedDB；本轮旧名称修正已为这些持久化数据加入显式兼容迁移，见“旧名称仍承担现功能”。

## 原始审计证据（修复前）

以下覆盖矩阵和 H/M/L 条目记录首次审计时的状态与删除依据。所有条目已按上方阶段记录处理，最终状态以“结论”“验证结果”和“最终确认”为准。

### Rust 专项复审覆盖矩阵

本轮没有把“能编译”“有测试”或“在 `generate_handler!` 注册”当作生产可达证据。Rust 模块逐项结论如下：

| 模块 | 生产状态 | 复审结论 |
|---|---|---|
| `fs/file.rs` | 现役 | 编辑器、主题文件和 Markdown 使用；`tempfile::NamedTempFile` 是生产原子写入依赖，不能删 |
| `fs/grep.rs` | 混合 | `fs_grep_interactive` 现役；`fs_grep`、`fs_glob` 仅注册和测试可达 |
| `fs/search.rs` | 混合 | `fs_search` 现役；`fs_list_files` 仅注册和测试可达 |
| `fs/mutate.rs`、`tree.rs`、`watch.rs` | 现役 | Explorer、editor、theme 与 SFTP 有真实消费者 |
| `git/commands.rs`、`operations.rs` | 混合 | 大部分现役；`git_diff`、`git_show_commit` 只通过无消费者 wrapper 出现 |
| `git/errors.rs`、`parser.rs`、`process.rs`、`types.rs`、`utils.rs` | 现役 | 被现役 Git 路径使用；`shared_child` 仍由 `git/process.rs` 使用 |
| `history/*` | 现役 | Blocks history 前端有 4 个真实 invoke |
| `proc.rs` | 现役 | Git 与 WSL 共同使用，不能随 shell 删除 |
| `pty/*` | 现役为主 | PTY、DA filter、Job Object、shell init 均有生产路径；仅 `pty_shell_name` 的前端文件不可达 |
| `secrets.rs` | 现役但损坏 | SFTP 真实调用，不能删除；当前是成功空操作，见 H1 |
| `sftp/*` | 现役为主 | command 均有前端 API 消费；另有两组测试自证式局部死代码，见 L16 |
| `shell/*` | 整体孤岛 | 8 个 command 无前端字符串，模块只被注册、自身和专属测试引用 |
| `workspace.rs` | 混合 | workspace 与 WSL 主路径现役；`wsl_default_distro` 无消费者，`authorize_spawn_cwd` 只服务孤立 shell |

### 前端模块复审覆盖矩阵

| 模块 | 生产状态 | 复审结论 |
|---|---|---|
| `app/` | 混合 | `App.tsx` 主协调链现役；3 个旧信息组件不可达，workspace switcher 还返回一个 Spaces 遗留成员 |
| `command-palette/` | 混合 | 主命令、文件/内容/历史搜索现役；消息树、测试 fixture、MRU 旧 key 兼容和多余导出需分别处理 |
| `editor/` | 混合 | CodeMirror、diff、媒体/PDF 预览现役；AI FIM prompt 文件不可达 |
| `explorer/` | 混合 | 文件树、搜索、监听、拖放和 Git decoration 现役；两个 Agent 菜单无 callback |
| `git-history/` | 现役 | 图、远程 URL、commit diff 有消费者；仅有多余导出面 |
| `header/`、`statusbar/` | 现役 | 搜索、cwd、workspace env 现役；barrel/常量导出可收口 |
| `i18n/` | 混合 | `zh-CN` 现役；英文 locale 已删，但恒定 locale 状态和大块旧消息仍在 |
| `markdown/` | 现役 | `streamdown` 和 Markdown tab 真实使用，不属于 Web Preview 残留 |
| `settings/` | 混合 | General/Themes/Shortcuts/About 现役；AI key 事件、语言状态、通知依赖和旧 registry 无消费者 |
| `sftp/` | 现役但有缺陷 | UI/API/transfer 全链路现役；凭据 backend 空操作，另有两组自证式 Rust dead code |
| `shortcuts/`、`sidebar/` | 现役 | 当前快捷键和两种 sidebar view 真实使用；多余 export 可收口 |
| `source-control/` | 混合 | Git 状态/暂存/提交/远程动作现役；AI commit generation 只剩永久禁用骨架 |
| `tabs/` | 混合 | 7 种当前 tab 与 split pane 现役；Spaces helper 退化为测试自引用，旧命名正迁移 |
| `terminal/` | 混合 | PTY、renderer pool、blocks、OSC、history 现役；Agent listener、AI output cap 与若干 export 无消费者 |
| `theme/` | 现役 | theme/editor pairing、文件、背景图均有消费者；启动 HTML key 漂移，旧 Terax key 仅应作为兼容 fallback |
| `workspace/` | 现役 | Local/WSL 切换现役；`parseWorkspaceScopeKey` 仅多余导出，不应删除实现 |
| `components/ui/` | 混合 | 现役 shadcn primitives 与 14 个不可达文件并存；当前 Knip/Biome ignore 会遮蔽后者 |

`src-tauri/src/modules/shell/` 的 5 个文件共 1,159 行，专属集成测试 `src-tauri/tests/shell_background.rs` 164 行，合计 1,323 行、28 个测试。`session.rs:15-16` 还用 `#[allow(dead_code)]` 压住未读字段 `started_at_ms`。这是整组不可达的附加证据，不是单独保留该字段的理由。

### Command 注册与消费者矩阵

修复前注册 81 个 command，其中 15 个无真实消费者。删除对应 command、Rust 实现、状态、wrapper 和专属测试后，最终矩阵为：

| 指标 | 数量 |
|---|---:|
| `generate_handler!` 注册 command | 66 |
| 非测试 `src/**/*.ts(x)` 中的字面量 `invoke()` 消费者 | 66 |
| 孤立注册 command | 0 |

机器比对同时排除了 `*.test.*` 和 `*.spec.*`，避免测试字符串替生产死链路续命。

### 编译器与工具结果

Rust 工具链位于 `D:\cargo\bin`，未加入默认 `PATH`；本轮通过仅对审计进程临时扩展 `PATH` 得到新的编译结果：

- `cargo check --all-targets --locked` 退出 0。
- `cargo clippy --all-targets --locked -- -D warnings` 退出 0。
- `cargo test --locked --no-run` 退出 0，全部测试目标完成编译。
- 实际运行 `cargo test --locked` 或单独的 `fs_search` 测试时，测试进程在启动阶段以 Windows `0xc0000139 STATUS_ENTRYPOINT_NOT_FOUND` 退出，没有进入断言阶段。该结果只能证明本机 DLL 运行环境异常，不能声称 Rust 测试通过或失败于业务断言。
- 已安装 `cargo-machete 0.9.2` 到 `D:\cargo\bin`；扫描未发现未使用 Rust 直接依赖。

因此 Rust 静态门禁通过，实际测试执行仍需修复本机 DLL 装载或交给 CI 完成。

## 原始高风险发现（已修复）

### H1. SFTP 凭据 API 全部成功返回但不存取数据

位置：`src-tauri/src/modules/secrets.rs:5-45`

```rust
pub struct SecretsState {
    store: RwLock<HashMap<String, String>>,
}

pub fn set_secret_value(...) -> Result<(), String> {
    let _ = (key, value);
    Ok(())
}

pub fn get_secret_value(...) -> Result<Option<String>, String> {
    let _ = key;
    Ok(None)
}
```

`src-tauri/src/modules/sftp/commands.rs:243-322` 正在调用这些函数保存和读取密码、私钥 passphrase。当前结果是：保存操作向 UI 报成功，实际没有写入 `store` 或系统凭据库；下一次连接始终读到 `None`。`store` 字段本身也是未读死字段。

建议：不要删除 `secrets` 模块，因为 SFTP 是真实消费者。应恢复可工作的系统 keychain 实现，或至少在当前进程内正确读写并明确持久化边界；补充保存、读取、删除和重启后的行为测试。此项应优先于纯死代码清理。

## 原始中风险发现（已修复）

### M1. 文件资源管理器仍显示“附加给智能体”，点击无动作

位置：

- `src/modules/explorer/FileExplorer.tsx:63,195,564,744-749`
- `src/modules/explorer/ExplorerSearch.tsx:55,70,309-314`
- `src/modules/i18n/messages/zh-CN.ts:261`

```tsx
<ContextMenuItem onSelect={() => onAttachToAgent?.(menuTarget.path)}>
  {messages.attachToAgent}
</ContextMenuItem>
```

`src/app/App.tsx:752` 挂载 `FileExplorer` 时没有传 `onAttachToAgent`。菜单仍显示，但 optional callback 永远为空。

建议：删除两个组件中的 prop、透传、两个菜单项和文案。

### M2. Source Control AI 提交信息只删了实现，骨架和永久禁用按钮仍在

位置：

- `src/modules/source-control/useSourceControlPanel.ts:22-23`
- `src/modules/source-control/useSourceControlPanel.ts:369-372,711-714,788-809`
- `src/modules/source-control/SourceControlPanel.tsx:53,439-445,809-842`
- `src/modules/i18n/messages/zh-CN.ts:427-430`

```ts
/^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert).../;
"You write concise Conventional Commit subject lines in English...";
const canGenerateCommitMessage = false;
const generateCommitMessageHint = "";
const generateCommitMessage = useCallback(async () => {
  return;
}, []);
```

`SourceControlPanel` 仍渲染 AI 图标按钮、tooltip 和 `Cmd/Ctrl+G` 分支。按钮永久 disabled，`aria-label` 只剩空 hint 加快捷键。

建议：删除裸表达式、状态字段、callback、快捷键分支、按钮、AI icon import、busy action 枚举和对应文案；随后检查 `anyActionBusy` 是否恢复真实用途，否则一起删除。

### M3. 前端永久监听后端已删除的 Agent 生命周期事件

位置：

- `src/modules/terminal/lib/agentActivity.ts:1-29`
- `src/modules/terminal/lib/useTerminalSession.ts:23,297,363`

```ts
void listen<AgentSignal>("terax:agent-signal", ...);
return s.commandRunning || (s.pty !== null && isAgentActivePty(s.pty.id));
```

`b822655` 已删除 Rust 端 detector 和 emitter，全库不存在 `terax:agent-signal` 发送方。因此集合永远为空，listener 和 Agent busy 分支永远无效。

建议：删除 `agentActivity.ts`、listener 初始化和 `isAgentActivePty` 分支，仅保留 `commandRunning`。

### M4. Blocks 输入框仍提示切换到已删除的 AI

位置：

- `src/modules/terminal/block/ShellInput.tsx:68-70`
- `src/modules/i18n/messages/zh-CN.ts:223-243`

```ts
inputPlaceholder: (shortcut) =>
  `运行命令  -  ↑ 历史  ${shortcut} 切换到 AI`,
```

同一区块还保留 `switchBetweenShellAndAi`、`openAiAssistant`、`attachToAiChat` 等无消费者文案。

建议：将 placeholder 改为真实交互说明，并删除整个 AI 文案子集及不再需要的 shortcut 参数。

### M5. 单语言化未收尾，恒定 `appLanguage` 仍被持久化和广播

位置：

- `src/modules/i18n/locale.ts:1-11`
- `src/modules/i18n/format.ts:1-23`
- `src/modules/i18n/index.ts:5-18`
- `src/modules/settings/store.ts:114,147,193,294-295,482-483,526`
- `src/modules/settings/preferences.ts:20,50-70,79,86-87`
- `src/modules/i18n/messages.test.ts:1-40`

```ts
export const APP_LANGUAGES = ["zh-CN"] as const;
export function coerceAppLanguage(_value: unknown) {
  return "zh-CN";
}
```

UI 和消息选择不再消费语言设置，但 store、Tauri store、localStorage fast path 和 change event 仍循环读写恒定值。`format.ts` 与 locale metadata 只有自家测试消费。`src/modules/source-control/useSourceControl.ts:99` 还调用 `messagesFor("en")`，参数被忽略。

建议：移除 `Preferences.appLanguage`、store key、setter、fast path、change map 和 locale-only 测试；保留简单的 `useMessages() => zhCN`。若数字格式仍有生产需求，再以固定 `zh-CN` 的普通 helper 引入。

### M6. 15 个 Tauri command 没有真实前端消费者

注册位置：`src-tauri/src/lib.rs:188,204-207,211,221,227-234,252`

| 命令 | 当前唯一可达路径 | 建议 |
|---|---|---|
| `shell_run_command` | 无前端 invoke | 删除 command 和实现 |
| `shell_session_open/run/close` | 无前端 invoke | 删除整套 persistent shell |
| `shell_bg_spawn/logs/kill/list` | 无前端 invoke | 删除整套 background shell |
| `fs_list_files` | 仅 `src-tauri/tests/fs_search.rs` | 删除 command、结果类型和对应测试 |
| `fs_grep` | 仅 Rust 测试；生产只用 `fs_grep_interactive` | 删除非交互 wrapper 和对应测试，保留共享搜索核心 |
| `fs_glob` | 仅 Rust 测试 | 删除 command、结果类型和对应测试 |
| `pty_shell_name` | 仅不可达 `useSystemInfo.ts` | 与前端死文件一起删除 |
| `wsl_default_distro` | 无前端 invoke | 删除 command；保留现役 `wsl_list_distros`、`wsl_home` |
| `git_diff` | 仅无消费者 `native.gitDiff` | 删除 wrapper、command、独占 operation/test |
| `git_show_commit` | 仅无消费者 `native.gitShowCommit` | 删除 wrapper、command、独占 operation/test |

整个 `src-tauri/src/modules/shell/` 当前只被自身、注册表和 `src-tauri/tests/shell_background.rs` 引用。删除后还应移除：

- `src-tauri/src/lib.rs:166` 的 `ShellState` 管理。
- `src-tauri/src/modules/workspace.rs:75` 的 `authorize_spawn_cwd()` 及只验证该 API 的测试。
- `src-tauri/tests/shell_background.rs`。
- `TERAX.md`、`CLAUDE.md` 中把该 shell API 描述为现役能力的段落。

注意：`src-tauri/src/modules/proc.rs` 仍被 Git 和 WSL 命令使用，不能随 shell 删除。`shared_child` 仍被 `src-tauri/src/modules/git/process.rs:11,265` 使用，也不能删。

### M7. 通知插件在前后端、权限和 lockfile 中完整残留

位置：

- `package.json:63`
- `src-tauri/Cargo.toml:40`
- `src-tauri/src/lib.rs:138`
- `src-tauri/capabilities/default.json:27`
- `pnpm-lock.yaml` 与 `src-tauri/Cargo.lock`

前端没有通知插件 import 或调用。Agent 通知组件已删除，当前只剩插件初始化和 capability，扩大依赖与权限面。

建议：删除 JS/Rust 依赖、plugin 初始化和 capability，然后用 `pnpm install --lockfile-only` 与 Cargo 更新 lockfile。

### M8. AI key 跨窗口事件完整存在但无消费者

位置：`src/modules/settings/store.ts:584-591`

```ts
const KEYS_CHANGED_EVENT = "terax://ai-keys-changed";
export async function emitKeysChanged() { ... }
export function onKeysChanged(cb: () => void) { ... }
```

全库没有调用 `emitKeysChanged()` 或 `onKeysChanged()`。

建议：删除事件常量、两个函数以及不再需要的 `emit`/`listen` import。

### M9. macOS 相机和麦克风权限仍完整声明

位置：

- `src-tauri/Info.plist:5-8`：`NSCameraUsageDescription`、`NSMicrophoneUsageDescription`。
- `src-tauri/entitlements.plist:5-8`：camera 与 audio-input entitlement。

当前前端没有 `getUserMedia()`、`mediaDevices` 或相机/麦克风插件调用，语音输入已由 `485c75e` 删除。这些声明会让系统和审核工具继续认为 Kite 需要采集设备权限，扩大用户感知和平台权限面。

建议：移除两份 plist 中的相机和音频输入声明，并在 macOS 构建产物上确认不再出现相应 usage description 与 entitlement。

### M10. CSP 仍为已删除网络代理和 Web Preview 放行

位置：`src-tauri/tauri.conf.json:28`

当前 `connect-src` 允许任意 `https:` 和两个 localhost 通配端口，`frame-src` 允许任意 `http:`、`https:`。删除前这些范围可服务 AI 网络代理、本地模型或嵌入式 Web Preview；当前 iframe 只用于 `EditorPane` 的 asset URL PDF 显示。

建议：先在运行态验证 Tauri IPC、SFTP 与插件不依赖 WebView 的广域 `connect-src`，再收紧到真实来源；`frame-src` 至少应验证能否只保留 `'self'`、`asset:` 和 `https://asset.localhost`。此项涉及安全策略，不能在没有桌面运行验证时直接猜一个最小值。

### M11. 启动页仍只读取旧 Terax 主题 key

位置：

- `index.html:11`
- `settings.html:11`
- 对照 `src/modules/theme/ThemeProvider.tsx:46-60`

```html
var t = localStorage.getItem("terax-ui-theme-shadow");
```

当前 `ThemeProvider` 已将主 key 改成 `kite-ui-theme-shadow`，仅在读取时兼容旧 key；两个 React 挂载前的内联启动脚本却仍只读旧 key。用户在新版本切换主题后，新 key 会更新而旧 key 不会更新，下一次启动首屏可能按系统主题或历史旧值绘制，等 React 挂载后才纠正，造成闪白、闪黑或设置窗口与主窗口首帧不一致。

建议：两个启动脚本先读 `kite-ui-theme-shadow`，为空时再回退 `terax-ui-theme-shadow`；最好抽成 Vite 可复用的最小启动模板或增加静态测试，防止两个 HTML 再次漂移。不要删除旧 key 回退，它仍承担升级兼容。

## 原始低风险死代码与残留（已修复）

### L1. 19 个完整不可达前端文件

业务文件：

| 文件 | 残留来源 | 建议 |
|---|---|---|
| `src/app/components/OsIcon.tsx` | Spaces/workspace UI | 删除 |
| `src/app/components/useGitBranch.ts` | Spaces/workspace UI | 删除 |
| `src/app/components/useSystemInfo.ts` | 旧系统信息 UI，唯一调用 `pty_shell_name` | 删除 |
| `src/lib/usePresence.ts` | 已删除 UI transition consumer | 删除；同步修正文档 |
| `src/modules/editor/lib/autocomplete/prompt.ts` | AI FIM system prompt | 删除 |

不可达 UI 子图：

```text
src/components/ui/alert.tsx
src/components/ui/button-group.tsx
src/components/ui/card.tsx
src/components/ui/collapsible.tsx
src/components/ui/empty.tsx
src/components/ui/hover-card.tsx
src/components/ui/item.tsx
src/components/ui/menubar.tsx
src/components/ui/radio-group.tsx
src/components/ui/separator.tsx
src/components/ui/sheet.tsx
src/components/ui/skeleton.tsx
src/components/ui/toggle-group.tsx
src/components/ui/toggle.tsx
```

`separator.tsx` 和 `toggle.tsx` 只被上述不可达 UI 文件引用，因此也是不可达子图的一部分。当前 `knip.json` 和 `biome.json` 整体忽略 UI 目录，会遮蔽这类问题。

建议：删除这 14 个文件；若把它们作为模板库存有意保留，就不能宣称仓库无死代码，且应将用途写入明确约定。

### L2. 两个生产模块只被自己的测试引用

位置：

- `src/modules/terminal/block/lib/outputCap.ts:1-26`
- `src/modules/terminal/block/lib/outputCap.test.ts:1-36`
- `src/modules/tabs/lib/useTabs.ts:121-130`
- `src/modules/tabs/lib/pickTabBySpaceIndex.test.ts:1-25`

`outputCap.ts` 的注释明确说明“让 AI 看到”输出首尾，生产无调用。`DEFAULT_SPACE_ID` 无消费者，`pickTabBySpaceIndex()` 退化成 `tabs[idx]` 且仅自测。

建议：成对删除源码和测试。原 `nextActiveInSpace()` 有生产调用，不能删除；本轮已改为普通 tab 语义 `nextActiveTab()`，并同步 `useTabCloseGuards.ts` 与测试。

### L3. 4 个无消费者的 native wrapper

位置：`src/lib/native.ts`

| wrapper | 行 | 处理 |
|---|---:|---|
| `gitCanonicalizeRoot` | 100 | 删除重复 wrapper；`fs_canonicalize` 仍有真实消费者 |
| `gitDiff` | 125 | 删除，且可继续删除 Rust `git_diff` 链路 |
| `gitPull` | 178 | 删除旧 alias；保留在用的 `gitPullFfOnly` 和 Rust command |
| `gitShowCommit` | 205 | 删除，且可继续删除 Rust `git_show_commit` 链路 |

不要误删：

- `canonicalize()` 被 `src/modules/explorer/lib/useGitStatus.ts:31` 使用。
- `gitRemoteUrl()` 被 `src/modules/git-history/GitHistoryPane.tsx:374` 使用。
- `gitDiffContent()`、`gitCommitFileDiff()` 被 `src/modules/editor/lib/diffCache.ts` 使用。

### L4. 4 个确定未使用的前端直接依赖

位置：`package.json`

| 依赖 | 行 | 来源/建议 |
|---|---:|---|
| `@radix-ui/react-use-controllable-state` | 55 | 无 import，删除直接依赖 |
| `@tauri-apps/plugin-notification` | 63 | Agent notification 残留，按 M7 删除 |
| `use-stick-to-bottom` | 94 | AI chat 残留，删除 |
| `zod` | 95 | AI schema 残留，无 import，删除 |

Knip 另报 `@fontsource/jetbrains-mono`，这是误报。`src/styles/fonts.css:28-49` 通过 CSS `url()` 真实引用其字体文件，不能删除。

### L5. 5 个确定残留和 1 个待 Cargo 确认的 Rust 直接依赖

位置：`src-tauri/Cargo.toml:33,41-49`

```toml
grep-matcher = "0.1"
reqwest = { version = "0.12", ... }
bytes = "1"
futures-util = "0.3"
tokio = { version = "1", ... }
```

`reqwest`、`bytes`、`futures-util`、`tokio` 是删除 `net.rs` 后留下的确定直接依赖残余；M7 的 `tauri-plugin-notification` 也确定无消费者，共 5 个确定项。`grep-matcher` 在当前 Rust 源码中没有 crate 路径引用，且 `grep-regex`/`grep-searcher` 会自行声明传递依赖，是第 6 个高置信候选，但本机没有 Cargo，不能把“零文本引用”冒充编译证明。

`tempfile` 不是可删项。`fs/file.rs:7` 与 `sftp/store.rs:7` 的生产原子写入使用 `tempfile::NamedTempFile`；Cargo.toml 同时在普通依赖和 dev 依赖声明 `tempfile`，可评估删除重复的 dev 声明，但必须保留生产依赖。

建议：删除后运行 `cargo machete`、`cargo check --all-targets --locked`、clippy 和 tests，再更新 `Cargo.lock`。

### L6. AI chunk 和 eager graph 配置仍在

位置：

- `vite.config.ts:88-98`
- `scripts/eager-graph-core.mjs:8-18`
- `src/app/eager-budget.test.ts:4-20`

```ts
if (id.includes("@ai-sdk/anthropic")) return "ai-anthropic";
if (id.includes("@ai-sdk/")) return "ai-sdk-shared";
```

当前依赖图没有任何 AI SDK，这些 manual chunk 分支与 eager watch 项永远匹配不到。测试描述、`HEAVY` 数组和示例仍锁定 AI/chat runtime。

建议：删除 AI 分支和 `@ai-sdk`/`ai` watch 项，保留仍在使用的 CodeMirror、streamdown 和 xterm 预算检查；同步改测试描述。

### L7. 配置 ignore 和 registry 指向已删除目录/产品

位置：

- `knip.json:11`：忽略不存在的 `src/components/ai-elements/**`，并整体忽略 UI 导致漏报。
- `biome.json:13`：忽略不存在的 `src/components/ai-elements/**`。
- `components.json:24-26`：保留 `@ai-elements` 远程 registry。

建议：删除 AI ignore 和 registry。评估取消 UI ignore，至少让 Knip 检查文件可达性；shadcn 生成文件的格式规则可单独保留。

### L8. `zh-CN.ts` 保留大块已删除功能文案

位置：`src/modules/i18n/messages/zh-CN.ts`

| 区块 | 行 | 内容 |
|---|---:|---|
| command palette | 58,64,135-152 | Spaces、AI 组、命令和 disabled 原因 |
| workspace input | 200-204 | Shell/AI mode |
| terminal blocks | 223-243 | AI 切换、AI attach、过期 placeholder |
| source control | 427-430 | AI 生成提交信息 |
| web preview | 504-522 | 已删除的嵌入式 Web Preview |
| AI 根文案树 | 532-819 | chat、tools、models、agents、voice 等 |
| settings tabs/language | 825-826,841-844 | Models、Agents、语言设置 |
| agent notifications | 912-917 | 已删除通知功能 |
| spaces shortcuts | 972,998-1000 | Spaces 分组和快捷键 |
| models/agents settings | 1013-1130 及后续 | 已删除页面的完整资源 |

建议：按真实组件属性访问面收缩 `zhCN`，不要继续让 `Messages = typeof zhCN` 把所有旧键合法化。清理后由 TypeScript 暴露遗漏消费者。

### L9. CSS 动画和注释残留

位置：`src/styles/globals.css:332-361,414-438,548`

- `terax-collapsible-down/up` 与 `.terax-collapsible-content` 全库无使用点，可删除。
- `terax-shimmer` keyframe、class 和 reduced-motion 分支也只有 CSS 内部自引用，没有组件消费者，首轮漏报，应一并删除。
- 原 `.terax-reveal`、`.terax-panel-in`、`.terax-tab-in` 和 `.terax-bg-surface` 仍承担当前 UI 功能，不能当残留删除；本轮已重命名为 `kite-*` 并修正 AI/voice 注释。

### L10. 测试 fixture 仍使用已删除功能概念

位置：

- `src/modules/command-palette/lib/fuzzy.test.ts:25,37`：`new private`、`toggle ai agent`。
- `src/app/eager-budget.test.ts:4-20`：AI stack 和 chat runtime。
- `src/modules/i18n/messages.test.ts:1-40`：只为恒定 locale/format 死代码续命。
- `src/modules/terminal/block/lib/outputCap.test.ts`、`pickTabBySpaceIndex.test.ts`：只测试无生产消费者的模块。
- `src-tauri/tests/shell_background.rs`：只测试无前端消费者的 shell subsystem。
- `src-tauri/tests/fs_search.rs:14-145,221-238`：只测试 `fs_grep`、`fs_glob`、`fs_list_files` 的用例。
- `src-tauri/tests/git_operations.rs:206-224,328-340`：只测试无消费者的 `git_diff` / `git_show_commit` operation。

建议：随生产链路删除相应测试；通用 fuzzy 测试改用当前命令词，不必删算法测试。

### L11. 产品元数据仍宣传已删除功能

位置：

- `src-tauri/tauri.conf.json:89-90`：`AI-native`、web preview、voice input、AI agents。
- `flake.nix:2`：`AI-native terminal (ADE)`。
- `nix/package.nix:71`：同上。

建议：统一改为当前真实定位，例如 open-source lightweight cross-platform terminal emulator。

### L12. 架构和安全文档与实现漂移

位置：

- `TERAX.md:17-37` 与 `:39-65` 大段重复。
- `TERAX.md:21,25` 仍写 AI tool surface。
- `TERAX.md:71-75` 把无消费者的 `fs_list_files`、`fs_grep`、`fs_glob`、shell 和 `wsl_default_distro` 写成现役 API。
- `TERAX.md:93,104` 仍把已删除 Web Preview 写入 tab union 和模块表。
- `TERAX.md:121` 声称使用实际不可达的 `usePresence`。
- `CLAUDE.md:51,54,62` 仍列 Web Preview、Spaces 和 background shell。
- `SECURITY.md:34` 仍称网络访问来自 Web Preview；现役 SFTP 同样会联网，因此描述不仅过期，还不准确。

建议：完成代码删除后，按最终 command/module 表重写对应段落，并删除 TERAX 重复块。

### L13. Roadmap 与计划文档仍以已删除功能为前提

位置：

- `ROADMAP.md:9-22,61-83,101`：Web Preview、AI as primitive、AI tools/skills、AI guard。
- `docs/high-value-feature-development-plan.md:7-358`：整份计划基于 AI、private terminal、models/agents deep link。
- `docs/sftp-phased-development-plan.md:45,481-535`：仍规划并声称完成 AI SFTP tools，引用已删除的 `src/modules/ai/tools/tools.ts`。

建议：若不再代表产品方向，删除或移入明确的历史归档目录；至少不能继续作为当前开发计划。

### L14. 旧功能图片和未引用文档截图

确定与删除功能相关且无引用：

- `docs/ai-workflow.png`
- `docs/web-preview.png`
- `terax-icon.png`

另外 `docs/editor.png`、`docs/source-control.png`、`docs/terminal.png`、`docs/themes.png` 当前也没有 Markdown/HTML 引用；README 使用的是 `docs/screenshots/workspace-*.png`。

建议：删除旧 AI/Web Preview 资产。其余四张若不是发布素材，也应删除或在文档中明确引用。

### L15. 141 个未使用导出项需要收口

完整 Knip 报告为 105 个未使用 value export 和 36 个未使用 exported type。多数实现内部仍在用，处理方式是移除多余 `export` 或 barrel 再导出，而不是删除实现。

高置信的非 UI 项：

```text
src/lib/platform.ts:12,23,24,26,27
src/modules/editor/lib/extensions.ts:10
src/modules/editor/lib/languageDefinitions.ts:25
src/modules/editor/lib/languageResolver.ts:89
src/modules/explorer/index.ts:2
src/modules/explorer/lib/fileIcons.ts:2681
src/modules/explorer/lib/folderIcons.ts:581
src/modules/explorer/lib/useFileTree.ts:33
src/modules/git-history/GraphRail.tsx:4,5
src/modules/git-history/lib/graph.ts:22,33
src/modules/header/index.ts:3
src/modules/i18n/index.ts:9,17,18
src/modules/settings/preferences.ts:66
src/modules/shortcuts/index.ts:3,15
src/modules/shortcuts/lib/shortcutLabel.ts:8
src/modules/sidebar/index.ts:1
src/modules/sidebar/SidebarRail.tsx:7
src/modules/sidebar/useSidebarPanel.ts:11
src/modules/source-control/index.ts:3-5
src/modules/source-control/useSourceControl.ts:93
src/modules/tabs/index.ts:1,7,10
src/modules/tabs/lib/useTabs.ts:121
src/modules/terminal/block/lib/inlineSuggest.ts:72
src/modules/terminal/index.ts:1,7,9,10,17,19-21
src/modules/terminal/lib/cursorStyle.ts:1,4,13
src/modules/terminal/lib/panes.ts:14
src/modules/terminal/lib/rendererPool.ts:42,57,146,1172,1589
src/modules/terminal/lib/useTerminalSession.ts:128,289,739,1122
src/modules/theme/bgImageStore.ts:57
src/modules/theme/index.ts:1,5
src/modules/theme/ThemeProvider.tsx:26
src/modules/workspace/env.ts:56
src/modules/workspace/index.ts:6,10
```

未使用 exported types 还包括：

```text
src/modules/command-palette/index.ts:4,6
src/modules/command-palette/types.ts:5,6
src/modules/git-history/lib/graph.ts:20
src/modules/git-history/lib/remoteWebUrl.ts:1
src/modules/i18n/index.ts:17
src/modules/sftp/lib/diffEntries.ts:10
src/modules/sftp/lib/types.ts:67
src/modules/shortcuts/index.ts:5,6
src/modules/shortcuts/lib/useGlobalShortcuts.ts:9
src/modules/source-control/index.ts:5
src/modules/source-control/useSourceControl.ts:17-19,23,53
src/modules/source-control/useSourceControlPanel.ts:25,30,57
src/modules/tabs/index.ts:5,14,20,21
src/modules/tabs/lib/useTabs.ts:89
src/modules/terminal/block/lib/modeMachine.ts:1,5
src/modules/terminal/index.ts:19-21
src/modules/terminal/lib/rendererPool.ts:57,1172
src/modules/theme/index.ts:1
src/modules/theme/ThemeProvider.tsx:26
src/modules/workspace/index.ts:10
```

UI 文件中另有 46 个未使用 export，集中在 `alert-dialog.tsx:192-196`、`badge.tsx:49`、`breadcrumb.tsx:121`、`button.tsx:65`、`command.tsx:189-193`、`context-menu.tsx:249-259`、`dialog.tsx:157-165`、`dropdown-menu.tsx:252-265`、`input-group.tsx:147-150`、`popover.tsx:85-88`、`scroll-area.tsx:53`、`select.tsx:184-188`、`tabs.tsx:88`。

建议处理顺序：先删不可达文件和 barrel 再导出，再跑 Knip；剩余项逐个将 `export` 降为模块内部声明。不要把 Knip 的“unused export”自动等同于“unused implementation”。

### L16. Rust 中 3 组局部死代码被测试或 allow 属性掩盖

| 位置 | 证据 | 建议 |
|---|---|---|
| `src-tauri/src/modules/sftp/path.rs:54-58,193-198` 的 `remote_temp_path()` | 生产上传使用稳定的 `.kite-part` / `.part` 路径；该 helper 只被自己的单元测试调用 | 删除 helper 和自证测试 |
| `src-tauri/src/modules/sftp/session.rs:5-12,28-35,37-53` 的 `SftpBackendDecision` / `SELECTED_BACKEND` | 运行态直接使用 `ssh2::Session`；决策常量只被自己的测试读取，字段 `version_req`、`notes` 连测试也未读取 | 删除结构、常量和“记录决策”测试；真实后端版本由 Cargo.toml 管理 |
| `src-tauri/src/modules/shell/session.rs:15-16` 的 `started_at_ms` | 字段显式 `#[allow(dead_code)]`，构造后从未读取 | 随整个孤立 shell 子系统删除；若暂缓子系统清理，至少删除字段和 allow |

这些项说明“测试通过”不能证明生产可达。测试若只读取一个生产从不读取的符号，就是在替死代码续命。

### L17. 两个 HTML 入口仍声明英文文档语言

位置：`index.html:2`、`settings.html:2`

```html
<html lang="en">
```

应用已删除英文 locale，当前唯一消息集是 `zh-CN`，但两个文档入口仍声明 `en`。这不是运行时死代码，却是单语言化删除未收尾的静态元数据残留，会让读屏器使用错误的发音规则，并影响浏览器语言相关行为。

建议：改为 `lang="zh-CN"`，并用一个轻量静态测试同时锁定两个 HTML 入口。

### L18. workspace switcher 仍构造并返回 Spaces 专用成员

位置：`src/app/hooks/useWorkspaceSwitcher.ts:29-32,113-125,134`

```ts
const adoptWorkspaceEnv = useCallback(async (env: WorkspaceEnv) => {
  // resolve and authorize a space's environment without resetting tabs
}, [setWorkspaceEnv, authorizeHome]);

return { ..., switchWorkspace, adoptWorkspaceEnv };
```

全库唯一调用方 `src/app/App.tsx:146-158` 只解构 `home`、启动 cwd 和 `switchWorkspace`，没有读取 `adoptWorkspaceEnv`。函数注释也明确写着“applies a space's env”，它来自已删除的 Spaces 生命周期。由于符号没有 `export` 且被装入返回对象，Knip 不会报告这一类死成员。

建议：删除 `adoptWorkspaceEnv` 及注释中的 Spaces 说明；保留现役交互式 `switchWorkspace`、`resolveEnvHome` 与 `authorizeHome`。

## 旧名称仍承担现功能：本轮已修正

这类问题不能只记入待办，否则后续开发会继续复制旧概念。本轮已做以下低风险、行为保持的改名：

- `nextActiveInSpace()` 改为 `nextActiveTab()`，同步 barrel、3 个生产调用、close guard 与测试文件名。
- 现役 UI/CSS/DOM 标识改为 `kite-*`：background surface、reveal、panel/tab animation、command palette input、renderer pool data attribute、开发调试全局钩子。
- settings window、preferences、custom theme 与 theme editor 的现役事件名改为 `kite:*` / `kite://*`。
- 默认主题从 `terax-default` 改为 `kite-default`，文件改为 `kite-default.ts`；settings schema v2 会把旧 ID 归一化并持久化。
- settings/custom theme store、localStorage fast path、sidebar/MRU key 与背景 IndexedDB 以 `kite-*` 为主名；只有新数据不存在时才读取旧 `terax-*`。Tauri Store 与 IndexedDB 会回写新位置，sidebar/MRU 则在首次读到旧 key 时立即复制到新 key；旧数据不删除，便于回滚。
- Rust 线程名、PTY cache/temp 路径、WSL 占位符、Bash/Zsh/Fish/PowerShell 私有函数与环境变量改为 `kite` / `KITE_*`，OSC 7/133 协议不变。

仍出现 `terax` 的合法边界应只剩：

- `LEGACY_*` 常量中的旧 store、localStorage、IndexedDB、默认主题 ID 和 `.terax-theme` 导入扩展名。
- `fs/file.rs` 对 `.terax.tmp` 老版本 staging symlink 的安全回归测试。
- PTY 初始化对旧 `terax.fish` 文件和 sentinel 的识别与清除，避免升级后重复注入 shell 配置。
- `TERAX.md` 文件名及 `AGENTS.md` 对它的引用，这是项目约定的 coding-assistant memory 入口。
- README 对原 Terax AI 项目的 fork 署名。

`index.html` 与 `settings.html` 已改为 Kite key 优先，仅在新 key 不存在时读取旧主题 key。

外部兼容标识 `CLAUDE_CODE_NATIVE_CURSOR` 也保留。它是下游 CLI 识别的协议变量，不是 Kite/Terax 产品品牌。

## 已复核的误报和保留项

- `@fontsource/jetbrains-mono`：CSS URL 真实使用，保留。
- `shared_child`：Git process 真实使用，保留。
- `src-tauri/src/modules/proc.rs`：Git 和 WSL 真实使用，保留。
- `native.canonicalize()`：Explorer Git status 使用，保留。
- `native.gitRemoteUrl()`：Git history 使用，保留。
- `native.gitDiffContent()` / `gitCommitFileDiff()`：diff cache 使用，保留。
- `streamdown`：Markdown preview 使用，保留。
- `nextActiveTab()`：原 `nextActiveInSpace()`，实现仍被 tab close 逻辑使用，本轮已完成改名。
- `.kite-reveal`：原 `.terax-reveal`，`WorkspaceInputBar` 真实使用，本轮已完成改名和注释修正。
- `tempfile`：生产原子写入真实使用；不能因它同时出现在 dev-dependencies 就删除普通依赖。
- `CLAUDE_CODE_NATIVE_CURSOR`：外部 CLI 兼容协议变量，不是旧产品品牌。
- `.coderabbit.yaml` 的 `language: en-US`：CodeRabbit 输出语言，不是应用英文 locale。
- `tauri.conf.json` 的 NSIS `languages: ["English"]`：安装器语言，不是前端 locale。
- Markdown preview、editor transient preview、theme preview、SFTP sync preview：与已删除的嵌入式 Web Preview 不同，均有真实消费者。
- README 对原 Terax AI 项目的 fork attribution：历史来源说明，不是功能声明，应保留。
- `secrets.rs`：虽然删除提交曾移除它，但 SFTP 当前真实使用，不能作为 AI 残留直接删除。

## 验证结果

通过：

- `pnpm lint -- --max-diagnostics=300`：103 个 warning、1 个 info、零 error
- `pnpm check-types`
- `pnpm test`：37 个测试文件、222 项测试通过
- `pnpm analyze:eager`
- `pnpm build`：773 个模块完成生产构建
- `pnpm knip`：零报告
- `pnpm size`：启动 JS 332.98 kB gzip / 540 kB；总客户端 JS 1.10 MB gzip / 1.50 MB
- `cargo machete`：零未使用 Rust 直接依赖
- `cargo check --all-targets --locked`
- `cargo clippy --all-targets --locked -- -D warnings`
- `cargo test --locked --no-run`：全部 Rust 测试目标编译成功
- 66 个 Tauri command 与非测试前端 `invoke()` 机器比对：零孤立注册
- package/Knip/Biome/components/Tauri/capability JSON 和两个 plist XML 解析
- CSP 复核：无任意 `https:` connect 和任意网页 frame 放行
- 资产复核：保留 README 截图、应用 logo 和 Tauri 平台图标；用户未跟踪的 `Terminus-SFTP-UI.png` 不在本轮范围
- PowerShell PTY profile 经 PowerShell parser 验证通过
- Bash/Zsh 通用脚本经 `bash -n` 验证通过；当前 WSL 无 `zsh`/`fish`，无法运行其原生 parser
- `pnpm tauri dev`：桌面应用成功启动，日志记录 Windows shell 初始化与首个 `pty opened`
- `git diff --check`

环境限制：

- `cargo test --locked`：完成编译，但首个测试进程启动时报 `0xc0000139 STATUS_ENTRYPOINT_NOT_FOUND`，没有进入断言。该结果是本机 DLL 加载问题，不是业务断言失败。

Rust 工具链实际位于 `D:\cargo\bin`，未加入默认 `PATH`；本轮命令均仅为当前进程临时扩展 `PATH`。

## 最终确认

本次审计的最终判断是：**8 个阶段全部完成，代码库在本审计范围内已清理干净**。Knip、cargo-machete 和 command 消费矩阵均为零残留；反向搜索命中均已归类为兼容、外部协议、历史署名或现役通用术语。唯一未闭合的验证是本机 Windows DLL 入口点错误导致的 Rust 测试运行限制，已明确记录，不影响静态清理结论。

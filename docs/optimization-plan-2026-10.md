# Kite 功能优化方案书

- 日期:2026-10-24
- 状态:待审核
- 基线:2.0.0,main 分支
- 审核方式:逐项点名批准,例如"批准 P0 全部"或"批准 P0-1、P1-3"

工作量标记:S 半天内,M 1 到 2 天,L 3 天以上(按 AI 辅助实施估算)。

## 1. 背景与前提

1. Kite 是独立维护的个人项目,已与原上游断开。不存在任何上游同步、合并或兼容义务,架构与产品决策完全自主。涉及设计基线变化的条目(例如会话恢复)在实施时同步更新 KITE.md。
2. 单用户产品。优化方向以实际使用体验为准,不考虑多用户与企业部署场景。
3. 第三方依赖的能力边界依然客观存在:xterm.js 是终端渲染的依赖库,不是项目上游。SIXEL 图片协议与连字渲染不可用是 xterm.js 及其 WebGL addon 自身的能力限制,与项目是否断开上游无关(见第 7 节)。
4. 本方案基于 2026-10-24 对前端(src/)与后端(src-tauri/)的两轮全量功能盘点,现状论断均以代码为据。

## 2. 现状盘点结论

### 2.1 已达成熟终端水准,维持不动

以下部分投入了成熟终端级别的正确性工作,本方案不触碰:

- 渲染槽池(5 槽共享)+ 休眠环形缓冲 + 快照序列化的内存模型。
- IME 组合期处理与候选框光标跟随(rendererPool.ts、imeAnchor.ts)。
- ConPTY 生命周期锁、Windows Job Object 杀进程树、异步关闭、输出合并与背压上限。
- OSC 7(cwd)、OSC 133(命令边界)、OSC 10/11(前景背景色查询)、OSC 12(光标色)、OSC 52(写剪贴板)全套 shell 集成;DA1/DA2/CPR 启动期代答。
- 可改键的快捷键注册表,带冲突检测与恢复默认(src/modules/shortcuts/)。
- 主题系统:16 套内置双变体主题、自定义主题导入校验、跨窗口同步。
- 文件拖放插入 shell 引用路径;滚轮事件按 TUI 鼠标跟踪模式路由。
- 安全面:严格 CSP、capabilities 逐项授权、shell override 白名单校验。

### 2.2 差距总览(对标成熟终端)

| 能力 | WT / iTerm2 / VS Code 现状 | Kite 现状 |
|---|---|---|
| 终端内搜索 | Ctrl+F 或 Ctrl+Shift+F 全员标配 | 无 |
| 链接打开门槛 | Ctrl/Cmd+点击跟随,悬停下划线 | 单击即开,无修饰键门槛 |
| 右键菜单/右键粘贴 | 全员标配 | 无,终端区无 contextmenu |
| 选中即复制 / 去尾空白 | 均为可配置项 | 无选项,复制不去尾空白 |
| 多行粘贴保护 | WT 与 VS Code 有确认弹窗 | 无,直接灌入 |
| 铃声与桌面通知 | iTerm2/WT 支持 BEL 与 OSC 9/777 | 无,onBell 未监听 |
| 后台标签活动指示 | WT/iTerm2/VS Code 有小圆点 | 无 |
| 面板最大化 | WT toggle pane zoom,tmux z | 无 |
| 每标签 shell / WSL | WT profile 体系一等公民 | 全局单一 shell,Windows 不枚举 WSL |
| 光标样式设置 | WT/iTerm2 可选 | 引擎已实现 4 种样式,但无 UI 且不持久化 |

## 3. P0:高价值快赢(建议首批)

### P0-1 终端内搜索(Ctrl+F)

- 参考:VS Code 终端、Windows Terminal Ctrl+Shift+F、iTerm2 Cmd+F。
- 现状:无任何缓冲区搜索能力。
- 方案:接入与 xterm 6 配套的 `@xterm/addon-search`,在 rendererPool 挂载。活动窗格右上角贴边弹出搜索条,复用 `kite-popover-motion` 动效。Enter/Shift+Enter 上下一个匹配,Esc 关闭并清除高亮,显示匹配序号计数(addon 的结果回调 API,接入时确认版本接口)。首版只高亮当前匹配,全部命中高亮作为后续增强。
- 涉及:rendererPool.ts、terminal 模块新增搜索条组件、shortcuts.ts(默认 Ctrl+F,可改键)、zh-CN 词条。
- 工作量:M。风险:低。注意搜索状态跟随活动窗格,不跨窗格泄漏。

### P0-2 链接打开门槛与协议白名单

- 参考:VS Code 的 Ctrl+点击跟随,悬停提示。
- 现状:WebLinksAddon 单击立即用系统 opener 打开。Claude Code 输出中 URL 密度高,选词时极易误触。
- 方案:用 addon 的 `willLinkActivate` 要求 Ctrl 按下才激活;悬停时下划线与"Ctrl+点击打开链接"提示;handler 只放行 http、https、mailto 等安全协议。设置中保留一档"单击直接打开"兼容旧行为。
- 涉及:rendererPool.ts(WebLinksAddon 构造)、GeneralSection、store。
- 工作量:S。风险:低。

### P0-3 终端右键菜单与剪贴板行为选项

- 参考:Windows Terminal 右键菜单与粘贴行为设置。
- 现状:终端区无右键菜单;无选中即复制;复制不去尾空白。
- 方案:右键弹出菜单,复用 TabBar 已在用的 Radix ContextMenu,条目:复制、粘贴、搜索、清屏、向右拆分、向下拆分、关闭窗格(条目按上下文禁用)。设置终端组新增三个开关:选中即复制、右键直接粘贴(开启时不弹菜单)、复制时去除尾部空白。
- 涉及:PaneTreeView 或 TerminalPane 挂菜单、rendererPool.ts 选区与复制路径、GeneralSection、zh-CN 词条。
- 工作量:S 到 M。风险:低。

### P0-4 多行与超大粘贴确认

- 参考:WT 与 VS Code 的 multi-line paste warning。
- 现状:Ctrl+V 直接写入 PTY,无任何保护。
- 方案:粘贴路径上检测:内容含换行、或超过阈值(建议 2048 字符)时,弹 AlertDialog 预览首行并显示"N 行 M 字符",确认后才粘贴。设置中可关闭。bracketed paste 场景(shell 支持时风险较低)与普通场景首版统一弹窗,保持行为可预期。
- 涉及:rendererPool.ts 粘贴处理、alert-dialog、GeneralSection。
- 工作量:S。风险:低。

### P0-5 光标样式设置 UI

- 参考:Ghostty 与 Warp 的光标样式选择,WT 的光标设置。
- 现状:光标引擎已实现 steady、blink、smooth、expand 四种样式与动画,但设置类型存在却无 setter、无 UI、不持久化。
- 方案:设置终端组新增光标样式下拉,store 补 setter 与持久化,挂到现有光标引擎。
- 涉及:store.ts、GeneralSection、zh-CN 词条。
- 工作量:S。风险:低。

## 4. P1:工作流增强(第二批)

### P1-1 铃声与桌面通知

- 参考:iTerm2、WT、WezTerm 对 BEL 与 OSC 9/777 的支持。
- 现状:完全无通知能力。
- 方案:接入 `tauri-plugin-notification`(Cargo 依赖与 capability 各一条);xterm `onBell` 与 OSC 9/777 注册 handler。设置新增通知区:总开关、仅窗口失焦时、仅后台标签、关闭。应用内提示优先复用已有 sonner;系统通知做增量开关。
- 涉及:osc-handlers.ts、rendererPool.ts、store、capabilities、Cargo.toml。
- 工作量:M。风险:Windows 未签名应用的系统 toast 可能显示通用应用名与图标,属已知外观限制,不影响功能。

### P1-2 后台标签活动指示

- 参考:WT、iTerm2、VS Code 的标签活动小圆点。
- 现状:后台 tab 有输出时无任何可见提示。
- 方案:在 rendererPool 数据入口(所有 leaf 输出必经之处,含休眠环写入)为非活动 tab 打活动标记,TabBar 图标处显示小圆点,切到该 tab 即清除。
- 涉及:rendererPool.ts、useTabs 或独立事件通道、TabBar.tsx。
- 工作量:S。风险:低。

### P1-3 命令完成通知(重点推荐)

- 参考:iTerm2 的 command finishes 通知,Warp 的命令完成提示。
- 现状:OSC 133 已完整解析,命令结束标记(D)已到达前端,但未利用。
- 方案:命令结束标记到达时,若所属 tab 非活动或窗口失焦,发送应用内 toast"命令已完成"。对"在 Kite 里跑 Claude Code 长任务、切去干别的"的场景是直接的效率件。复用 P1-1 的通知基建,建议与 P1-1 同批实施。
- 涉及:osc-handlers.ts、useTerminalSession.ts、通知通路。
- 工作量:S。依赖:P1-1。

### P1-4 面板最大化与均分

- 参考:WT 的 toggle pane zoom,tmux 的 z。
- 现状:面板只能平铺,无专注放大。
- 方案:新增"最大化当前窗格":隐藏同 tab 兄弟窗格但 PTY 保活,与"隐藏 tab 不卸载"的现有哲学一致;再次触发或 Esc 退出。顺带新增"均分窗格"命令。两者进命令面板与快捷键注册表,默认键实施时定(候选 Ctrl+Shift+Enter,经注册表冲突检测确认)。
- 涉及:PaneTreeView.tsx、panes 状态、commands.ts、shortcuts.ts。
- 工作量:S 到 M。风险:与专注模式(Ctrl+Shift+Z)叠加时的层级需明确:专注模式隐藏 Header,窗格最大化隐藏兄弟窗格,两者正交。

### P1-5 每标签 shell 选择

- 参考:WT 新标签下拉。
- 现状:shell 是全局设置,所有 tab 同一 shell。
- 方案:后端 `pty_open` 本就按次接收 shell 参数并有白名单校验,只差前端:tab 记录自己的 shell;新建标签按钮长出下拉;命令面板"新建终端"增加 shell 子页(照抄主题子页交互)。
- 涉及:useTabs.ts(tab 增加 shell 字段)、pty-bridge.ts、TabBar.tsx、commands.ts。
- 工作量:M。风险:低。

### P1-6 WSL 枚举与启动

- 参考:WT、WezTerm、Tabby 将 WSL 作为一等公民。
- 现状:Windows 枚举 pwsh、PowerShell 5.1、cmd、Git Bash,无 WSL。
- 方案:`wsl.exe -l -q` 枚举发行版(注意其输出为 UTF-16LE,需解码),每个发行版作为独立 shell 项;启动用 `wsl.exe -d <发行版> --cd <cwd>`;shell 集成沿用现有 bash 脚本。未安装 WSL 时自然不出现。
- 涉及:shell_init.rs(list_shells 与 spawn 分支)、前端无需大改(枚举结果天然进下拉)。
- 工作量:M 到 L。风险:WSL 内环境差异需要实测(PATH、locale、集成脚本路径需落到 WSL 文件系统侧或经 wsl 传入)。

### P1-7 关闭守卫精度(Job Object 查询)

- 参考:WT 基于 Job Object 的子进程感知。
- 现状:前台进程检测只看直接子进程。cmd 启动 node 再启动 npm 的场景查不到,关闭标签时误判"无运行中程序"。
- 方案:Windows 上每个会话已建 Job Object,用 `QueryInformationJobObject` 查 `JobObjectBasicProcessIdList` 得到活跃进程数,即可精确判断整棵树是否存活。同时让渲染器休眠判定更准。Unix 侧维持现有逻辑。
- 涉及:job.rs、pty/mod.rs(has_foreground_process)。
- 工作量:M。风险:低。纯逻辑改动,按 RULE.md 只打 exe。

### P1-8 Unicode 11 宽度表

- 参考:Ghostty、WT 使用现代宽度表。
- 现状:xterm 默认宽度表较旧,部分 emoji 与新增 CJK 字符宽度计算不准,中文环境下出现对齐毛刺。
- 方案:接入 `@xterm/addon-unicode11` 并激活 v11 宽度表,在终端实例创建时设置。
- 涉及:rendererPool.ts(termOptions 与创建流程)、package.json。
- 工作量:S。风险:低。

## 5. P2:更大步子(按需批准)

### P2-1 会话恢复(可选启动恢复布局)

- 参考:WT persisted window layout、VS Code 持久会话、iTerm2 Arrangements。
- 现状:KITE.md 明确"标签不跨启动持久化"是设计决策,本条属于推翻该决策的产品变更,需明确批准。
- 方案:设置新增"启动时恢复上次会话布局"(默认关)。退出时保存 tab 清单:顺序、每 tab 的 shell、pane 树结构、每 pane 最后的 cwd(OSC 7 已有)。启动恢复时重开 PTY(不回放缓冲区内容)。
- 涉及:useTabs.ts、store、App.tsx 退出路径;KITE.md 同步更新。
- 工作量:M 到 L。风险:崩溃退出与正常退出的区分;恢复时 shell 白名单可能已变化(失效项跳过)。

### P2-2 多窗口

- 参考:WT、iTerm2 多窗口。
- 方案:命令面板与快捷键新增"新建窗口",复用现有主窗口创建路径;single-instance 已就绪,新窗口启动目录跟随当前活动 tab 的 cwd。
- 涉及:后端新增开窗命令、commands.ts、App 层窗口标识。
- 工作量:L。风险:渲染槽池目前按 webview 单位还是全局共享需先定;跨窗口状态(设置同步)已有事件通路。

### P2-3 en-US 语言包(已移除,不做)

- 2026-10-24 用户决定移除该项:仅保留 zh-CN 单语言,不新增语言包与语言切换设置。i18n 架构的多语言预留维持现状(不影响其他条目)。

### P2-4 Quake 全局呼出

- 参考:WT quake mode、Guake。
- 方案:接入 `tauri-plugin-global-shortcut`,注册全局热键,窗口从屏幕顶部滑出/收回。
- 涉及:Cargo 依赖、capability、窗口动效(遵守 Motion 章规则:只动 transform 与 opacity)。
- 工作量:M。风险:全局热键与其他软件冲突;窗口动画需与现有首帧 show 逻辑协调。

### P2-5 检查更新

- 参考:开源桌面应用惯例。
- 现状:无更新检查;发布为手动 GitHub Releases;tauri updater 产物关闭。
- 方案分两档:
  - 轻量:About 页新增"前往下载页",用现有 opener 打开 Releases 页。零新权限,S。
  - 进阶:后端新增命令拉取 GitHub API 最新 tag 与当前版本对比,提示有新版。注意 CSP 的 connect-src 不放行外网,必须走后端命令而非前端 fetch。S 到 M。
- 不引入 updater 全套签名与自动安装体系(见第 7 节)。

## 6. 顺手小修(技术债,任意批次捎带)

1. 清理 session.rs reader 线程残留的 `[wheeldbg]` 调试日志(release 仍在输出),并入 `VITE_KITE_WHEEL_DEBUG` 门控或删除。
2. 主窗口默认尺寸 800x600 偏小,首启观感一般,建议提到 1100x700 附近;老用户由 window-state 插件恢复,不受影响。
3. 验证 xterm 6 core 是否已内置列选择(Alt 加拖拽的矩形选区,VS Code 终端已有):有则直接启用,S;没有则归入 P2 自研,不阻塞其他条目。

## 7. 明确不做及理由

1. SIXEL 与图片协议、连字(ligatures)渲染:xterm.js 的 WebGL addon 不支持,自研渲染层成本极高,该结论与项目是否有上游无关,是依赖库的能力边界。等 xterm.js 生态支持后再评估。
2. AI 命令补全(Warp 方向):与轻量克制的定位冲突,维护成本高。
3. SSH 与远程主机管理(Tabby 方向):需要后端开网络栈,破坏现有"webview 不触网、后端薄"的安全边界设计。
4. 背景图片与亚克力材质:性能代价明确(刚移除 backdrop-blur 换来的流畅度),与现有审美方向冲突。
5. 文件浏览器、侧栏、状态栏、开机自启:KITE.md 与安装器均已明确裁剪,维持。
6. updater 自动更新全体系:需要签名密钥与产物分发链路维护,单用户手动更新成本更低。

## 8. 实施批次与交付规则

1. 批次一:P0 全部(搜索、链接门槛、右键菜单、粘贴保护、光标 UI)。以 UI 改动为主。
2. 批次二:P1-1、P1-2、P1-3、P1-4、P1-8(通知与面板组)。
3. 批次三:P1-5、P1-6、P1-7(shell 能力组;P1-7 纯逻辑单独只打 exe)。
4. P2 按点名单独排批。
5. 每批验证:pnpm lint、check-types、test、build、size、knip 全套,cargo check、clippy、nextest;交互类改动用 Playwright 验证;交付按 RULE.md 打包规则:全部改动只打 NSIS exe 复制桌面;MSI 已于 2026-10-24 移除(targets 固定 nsis)。
6. UI 同步设计与微调要求(2026-10-24 批准 P0 时追加,适用于所有批次):新增 UI 必须与现有设计系统同步,复用现有 shadcn/ui 组件、Hugeicons 图标与 Motion token(--dur-*、--ease-*、kite-* 动效类),不引入新的原始毫秒值或贝塞尔字面量;间距、字号、圆角、控件比例遵循对应分区现有节奏,不自创新样式;每处新 UI 落地后必须逐状态微调目检(默认态、悬停、聚焦、禁用、空态、溢出、键盘可达),未经过微调的 UI 不得交付。

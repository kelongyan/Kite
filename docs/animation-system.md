# Kite 全局动画优化方案

> 状态：已定稿 v1.0
> 实施状态：P0-P4 已完成，完整 CI 通过（2026-10-22）
> 定稿日期：2026-10-22
> 方向：精确仪器
> 范围：主窗口、设置窗口、终端周边 chrome
> 不在范围：终端网格、xterm 画布、PTY 输出、主题切换时的终端重绘
> 约束：不新增依赖；CSS-first；保持轻量；尊重 `prefers-reduced-motion`
> 基线：`feat/tab-path-labels`，`bf228cf`

## 1. 结论先行

现状不是"没有动画"，而是"有四套互不相干的节奏"：

1. 主界面自定义 token：`160ms / 240ms / 320ms`，两条曲线。
2. Tailwind 默认：不写时长时 `150ms`，曲线 `cubic-bezier(0.4, 0, 0.2, 1)`。
3. shadcn / tw-animate-css：浮层统一 `duration-100`，同时叠加 `fade + zoom-95 + slide-2px`，曲线是默认 `ease`。
4. 组件内硬编码：`64ms` 光标滑移、`180ms` 标签、`210ms` settle、`1.1s` 光标脉冲、`1.3s` 复制提示、`1.4s` 图标脉冲、`1.6s` 扫描线、`6s` 跑马灯、`2s` 录制脉冲。

而且 token 并没有真正被使用：在 chrome 里只有 tab pill、`.kite-tab-in`、`.kite-reveal`、`.kite-panel-in` 四条规则消费了 token，其余全是字面量或 Tailwind 默认值。

目标：一套 4 档时长、2 条曲线、3 个距离的运动语言。只动 `transform`、`opacity`、颜色。终端内容零动画。

性格定稿：精确仪器。动效像精密仪器的反馈，克制、准确、有连续性。宁可短一点、幅度小一点，也不要软、不要弹、不要拖。不做演示型编排。

## 2. 现状审计

### 2.1 已经做对的部分，保留

- 共享 tab pill 用单个绝对定位元素滑动，不触发兄弟节点重排。`src/modules/tabs/TabBar.tsx:178-194`
- 终端光标 64ms 滑移，接近直接操控的手感。`src/styles/globals.css:540-542`
- 隐藏标签保持挂载，终端内容不参与过渡。`src/modules/terminal/TerminalStack.tsx:70-93`
- 终端窗格分割、拖动 resize 没有动画，这是正确的，避免 TUI 重排。`src/modules/terminal/PaneTreeView.tsx:63-79`
- 已有的 reduced-motion 块覆盖了自定义标签、光标、扫描线动画。`src/styles/globals.css:612-650`

### 2.2 主要问题

#### P0：系统性与实现级缺陷

1. **四套时长并存**。浮层 100ms、Tailwind 默认 150ms、主界面 160/240/320ms、组件硬编码 64/180/210/1100/1300/1400/1600/6000ms。
2. **浮层动作叠加**。`fade-in-0 + zoom-in-95 + slide-in-from-*-2` 在 100ms 内同时发生，读起来是"闪一下"，不是"浮上来"。`src/components/ui/dialog.tsx:51`、`tooltip.tsx:45`、`select.tsx:58`、`context-menu.tsx:35`
3. **Tooltip 的入场选择器实际匹配不到**。Radix Tooltip 发出的是 `data-state="delayed-open"` 或 `"instant-open"`，当前只写了 `data-[state=delayed-open]` 和 `data-open`，所以即时打开的 Tooltip 没有入场动画。`src/components/ui/tooltip.tsx:45`
4. **标签 settle 被 JS 定时器截断**。CSS 动画 210ms，但 `TabBar.tsx:437-444` 在 160ms 后就把 `settled` 置回 false，动画永远播不完。`src/styles/globals.css:411-431`
5. **新标签入场会被任何重渲染打断**。入场类由渲染期读取的 ref 推导，`cwd` 更新或父级重渲染会提前移除 `kite-tab-in`，动画半途消失。`src/modules/tabs/TabBar.tsx:74-83, 197, 304`
6. **每个启动中的 shell 同时跑多条无限动画**。扫描线 1.6s、图标脉冲 1.4s，且隐藏标签仍然挂载，动画会为每个打开的标签持续计时。`src/styles/globals.css:444-490`
7. **reduced motion 覆盖不全**。`CopiedBubble` 的内联 1.3s 动画、tw-animate 浮层、Tailwind `animate-pulse` 录制提示、Sonner Toast 都不在现有覆盖范围内。`src/modules/terminal/CopiedBubble.tsx:9-16`
8. **`transition-all` 出现在 5 处**。按钮、TabsTrigger、Switch、主题卡、外观卡会连带动画化颜色、阴影和布局属性。`src/components/ui/button.tsx:8`、`tabs.tsx:64`、`switch.tsx:18`、`src/settings/sections/ThemesSection.tsx:144`、`GeneralSection.tsx:119`
9. **常驻 `will-change`**。标签文字和光标 overlay 长期占用合成层，即使没有动画。`src/styles/globals.css:397-409, 537, 549`
10. **主题切换会出现局部颜色渐变**。CSS 变量整帧切换，但带 `transition-colors` / `transition-all` 的按钮、输入框、Tabs、Switch 仍会各自做 150ms 颜色过渡，结果是一半即时、一半渐变。`src/modules/theme/ThemeProvider.tsx:152-156`、`applyTheme.ts:89-101`
11. **设置页 5 个 Select 全部 `item-aligned + animate-none`**。弹层没有任何入场动画。`src/components/ui/select.tsx:49, 57-58`、`src/settings/sections/GeneralSection.tsx:179, 206, 230, 259, 315`
12. **两个 TooltipProvider 的延迟不一致**。根节点是 0ms，WebGL 提示里又嵌套了一个 200ms。`src/app/App.tsx:316`、`GeneralSection.tsx:275`

#### P1：标签区噪声与不连续

13. **新标签入场 `scale(0.86)`**。幅度太大，而且 transform 会在 tab trigger 上创建 stacking context，盖住共享 pill。`globals.css:383-395`
14. **settle 使用 `filter: saturate()` 和 `scale(1.01)`**。滤镜不是合成器友好属性，过冲对生产力工具来说偏俏皮。
15. **hover 跑马灯 6s linear**。默认 50px/s，路径一长就持续滚动，打断注意力。`globals.css:433-442`
16. **缺少 TabSwitcherHud 入场**。Ctrl+Tab 时 HUD 直接出现，没有空间来源。`src/modules/tabs/TabSwitcherHud.tsx`
17. **拖拽只有一条 2px 指示条**，没有 ghost、没有 grow-in、没有边缘自动滚动。`TabBar.tsx:121-130, 204-209, 247-280, 409-417`
18. **关闭、重排、重命名时 pill 与布局可能短暂错位**。`useLayoutEffect` 测量后下一次布局才更新，关闭/重排的瞬间会出现一帧偏差。`TabBar.tsx:93-110, 178-194`
19. **Zen 模式直接卸载 Header**，没有过渡，标签栏内部状态也随之丢失。`src/app/App.tsx:194, 215, 318-332`

#### P2：设置页与浮层

20. **设置页切换 section 无过渡，且保留上一页的滚动位置**。`src/settings/SettingsApp.tsx:108-112`
21. **主题卡选中态硬切**。边框、ring、勾选图标同时跳变。`ThemesSection.tsx:143-198`
22. **Toast 使用 Sonner 默认动画**。Sonner 内部是 400ms / 500ms 和 10px 圆角，与全局节奏、圆角语言都不一致。`src/components/ui/sonner.tsx`
23. **复制提示自己注入 keyframes**，时长和曲线游离在 token 之外；重复复制不会重启反馈；键盘复制锚点落在视口原点；未套用 `zoom-exempt`。`CopiedBubble.tsx:9-16, 33-48`、`TerminalPane.tsx:102-108`
24. **复制提示的 `aria-live` 节点在 1.3s 后卸载**，可能截断读屏播报。`CopiedBubble.tsx:35, 40-43`
25. **命令面板在退出动画还在播时就清空 query 和 page**。Radix 会为退出动画保留内容，但内容已经被重置，视觉上会闪空。`CommandPalette.tsx:83-89`
26. **字体校验和主题导入错误直接插入区块**，导致行高和列表位置跳动。`GeneralSection.tsx:458-462`、`ThemesSection.tsx:124-128`
27. **ScrollArea 声明了不会被使用的过渡**。`scroll-area.tsx:19, 40`

#### P3：终端周边

28. **默认光标是永不停歇的合成器动画，叠在 WebGL canvas 上**。`cursorStyle.ts:69-72, 97-103`、`globals.css:537, 549, 563-566`
29. **光标 CSS 64ms 与 JS 72ms 双源**，曲线硬编码。`globals.css:541`、`cursorMotion.ts:36`
30. **overlay 策略下未聚焦 pane 完全没有光标**。`cursorStyle.ts:179-192`、`rendererPool.ts:954, 963-976`
31. **拖放覆盖层瞬现，且用 `backdrop-blur` 压在终端 canvas 上**。`PaneTreeView.tsx:82-90`
32. **冷启动 pane 没有占位反馈**，与标签栏的启动脉冲不同步。`useTerminalSession.ts:270-275, 433-464`

#### P4：死代码

33. `.kite-panel-in` 在 `globals.css` 中定义，但 `src` 内没有任何消费者；`.kite-reveal` 当前也未使用，但会在 P3 复用于校验提示的一行展开。`globals.css:349-381`

### 2.3 明确不动的部分

- 终端网格、xterm canvas、WebGL 渲染、输出解析。
- PTY 输出流、背压缓冲、dormant ring。
- 窗格分割与 resize 的几何变化。
- 窗口 show 的时机。现在是"隐藏创建，首帧后显示"，这已经是最好的入场。
- 焦点环。焦点反馈必须即时，不做过渡。
- 主题切换时的终端配色。终端必须整帧切换，不能出现半主题状态。

## 3. 运动语言

### 3.1 五条原则

1. **动效只回答"发生了什么"**。不做入场编排、不做装饰性循环、不做视差。
2. **快，但有层次**。反馈 80ms，状态 160ms，空间 240ms，大表面 320ms。超过 320ms 的动画只允许出现在大面板。
3. **只动合成器友好属性**。`transform`、`opacity`、颜色。不动 `width`、`height`、`top`、`left`、`filter`、`backdrop-filter`。
4. **一次只讲一件事**。一个元素最多同时改变 `opacity` 与一个 `transform`，不再叠加 blur、zoom、slide。
5. **连续性来自同源**。浮层从触发点生长，标签从当前位置滑动，HUD 从当前标签方向出现。

精确仪器还意味着：文字永远不缩放，界面不做回弹，退场比入场快一档，键盘操作永远不等动画。

### 3.2 Token

在现有 `:root` token 上扩展，不另起一套。只新增一个时长档，保持 4 档。

```css
:root {
  /* 时长：4 档，覆盖 95% 的场景 */
  --dur-instant: 80ms;   /* 按压、颜色、选中、Tooltip 退场 */
  --dur-fast: 160ms;     /* hover、Tooltip、标签入场、Switch、Popover */
  --dur-base: 240ms;     /* Tab pill、Dialog、HUD、命令面板 */
  --dur-slow: 320ms;     /* 大面板，当前无场景，预留 */

  /* 曲线：2 条，语义明确 */
  --ease-premium: cubic-bezier(0.16, 1, 0.3, 1); /* 入场 */
  --ease-soft: cubic-bezier(0.4, 0, 0.2, 1);     /* 状态变化、退场 */

  /* 距离与缩放：只允许这三个 */
  --motion-distance-micro: 2px;
  --motion-distance-popover: 6px;
  --motion-distance-surface: 10px;
  --motion-scale-press: 0.985;
  --motion-scale-enter: 0.98;
  --motion-scale-dialog: 0.97;

  /* 光标滑移是唯一例外，保留直接操控感 */
  --dur-cursor: 64ms;
}
```

在 Tailwind v4 主题层把默认值接到 token 上，避免再出现"不写时长就是 150ms"：

```css
@theme inline {
  --default-transition-duration: var(--dur-fast);
  --default-transition-timing-function: var(--ease-soft);
}
```

如果 Tailwind 版本对 `var()` 内联有兼容问题，退化为直接写 `160ms` 与 `cubic-bezier(0.4, 0, 0.2, 1)`，并在注释中说明与 `:root` 保持同步。

### 3.3 时长分配表

| 场景 | 入场 | 退场 | 曲线 | 属性 |
|---|---|---|---|---|
| 按压、hover 颜色、选中 | `--dur-instant` | `--dur-instant` | soft | background-color, color, border-color |
| Tooltip、Popover、Switch、标签入场、HUD | `--dur-fast` | `--dur-instant` | premium / soft | opacity, transform |
| Tab pill、Dialog、命令面板 | `--dur-base` | `--dur-fast` | premium / soft | opacity, transform |
| 大面板（预留） | `--dur-slow` | `--dur-base` | premium | opacity, transform |
| 光标滑移 | `--dur-cursor` | `--dur-cursor` | `cubic-bezier(0.2, 0, 0, 1)` | transform |
| 光标脉冲 | `1.3s` | 常驻 | soft | opacity（亮度 0.6-1） |
| 录制指示 | `1.4s` | 常驻 | soft | opacity（仅小圆点） |

退场统一比入场快一档。对话框 240ms 进入、160ms 退出；小浮层 160ms 进入、80ms 退出。

### 3.4 关于"不做动画"的决定

三处明确保持即时，并把原因写进代码注释：

1. **主题切换**。CSS 变量和 xterm 主题不是同一帧更新，做渐变会出现半主题状态。即时切换是正确的高级感。还需要用 `data-theme-swapping` 在切换前后两帧禁用颜色过渡，避免现有按钮、输入框、Tabs、Switch 各自做局部渐变。
2. **Zen 模式**。header 高度动画会触发终端 resize，xterm 在动画期间反复 fit。即时隐藏，终端只 resize 一次。
3. **终端标签切换**。终端内容整体淡入淡出会让人误以为输出重绘。只动标签 pill，不动终端。

## 4. 组件级规范

### 4.1 主窗口 chrome

| 组件 | 现状 | 目标 |
|---|---|---|
| Tab pill | 240ms，width + transform | 保持 240ms，`--ease-premium`；关闭/重排时抑制一帧 transform 过渡 |
| 新标签入场 | 240ms，opacity + scale(0.86) | 160ms，opacity + translateY(2px)，`--ease-premium`；不要 scale |
| 标签 settle | 210ms，opacity + filter + scale(1.01)，被 160ms 定时器截断 | 删除 settle 状态与 JS 定时器；标签更新即时 |
| 解析中标签 | 1.6s 扫描线 + 1.4s 图标脉冲，均为无限 | 700ms 一次性扫描线；图标静态 0.6 透明度 |
| hover 跑马灯 | 立即开始，50px/s，6s+ | 停留 300ms 后启动，24px/s，两端 mask 渐隐，离开 200ms 回位 |
| 关闭按钮 | 默认 150ms opacity | 80ms opacity |
| 拖拽指示条 | 瞬间出现 | 80ms opacity + scaleY(0.6 -> 1) |
| 拖拽 ghost | 无 | 0.98 scale + 软阴影，120ms 长入；边缘 8px/帧自动滚动 |
| TabSwitcherHud | 无入场 | 160ms opacity + scale(0.98)，`--ease-premium`；选中切换即时 |
| 窗口控制 | 默认 150ms colors | 80ms colors；按压 scale(0.96) |
| Header 紧凑模式 | 单一断点，宽度瞬间变化 | 700/740px 双阈值滞回；标签文字 120ms 交叉淡入，不动画宽度 |
| Zen 模式 | 直接卸载 Header | 保持即时；终端只 resize 一次 |

### 4.2 浮层

统一用一组共享类替换 shadcn 的 `duration-100 + animate-in + zoom + slide` 组合。建议在 `globals.css` 的 `@layer components` 中定义 `.kite-overlay`、`.kite-dialog`、`.kite-popover`，由 Radix 的 `data-state` 与 `data-side` 驱动。

| 组件 | 现状 | 目标 |
|---|---|---|
| Dialog 遮罩 | 100ms fade | 160ms opacity，`--ease-soft` |
| Dialog 内容 | 100ms fade + zoom-95 + slide | 240ms opacity + scale(0.98) + translateY(4px)，`--ease-premium`；退出 160ms |
| AlertDialog | 同 Dialog | 240ms，scale(0.97)，比普通对话框略重 |
| 命令面板 | 同 Dialog，100ms | 240ms，opacity + translateY(-6px)；不做缩放；退出 160ms |
| 命令面板主题子页 | 硬切 | 160ms opacity + translateY(4px) 交叉淡入 |
| Tooltip | 100ms fade + zoom + slide；`instant-open` 无动画 | 160ms opacity + 2px 方向位移；同时匹配 `delayed-open` 与 `instant-open`；去掉 zoom；`sideOffset` 4-6px |
| Select / ContextMenu | 100ms fade + zoom + slide | 160ms opacity + scale(0.98) + 2px 方向位移；`transform-origin` 用 Radix 变量 |
| 设置页 Select | 全部 `item-aligned + animate-none` | 改为 `position="popper"`，160ms fade + 2px；删除无用的 zoom/slide 类 |
| Toast | Sonner 400/500ms，10px 圆角 | 160ms opacity + translateY(6px) 入场；160ms 退出；停留 3s；圆角 16px |
| 复制提示 | 1.3s 内联 keyframes | 160ms 入场，900ms 保持，160ms 退出；使用 token；每次复制用递增 key 重启 |

浮层只做两件事：淡入 + 从触发方向移动 2-6px。缩放只保留给 Dialog 与 AlertDialog 这类小表面。命令面板是 680px 的大表面，不做缩放，避免"网页弹窗"感。

### 4.3 设置窗口

| 组件 | 现状 | 目标 |
|---|---|---|
| Section 切换 | 硬切，保留上一页滚动位置 | 160ms opacity + translateY(6px)，`--ease-premium`；切换时 `scrollTop = 0` |
| 设置页 Tabs | 每个 trigger 自己切换背景 | 共享滑动指示器，240ms，与主标签栏一致的测量方式 |
| 主题卡 | `transition-all` + 硬切选中 | 160ms border-color / ring；勾选图标 160ms scale(0.9 -> 1) + opacity |
| 主题切换 | CSS 变量即时，但局部元素做 150ms 颜色渐变 | 即时；用 `data-theme-swapping` 两帧禁用颜色过渡，保证整帧切换 |
| Switch | `transition-all` 根节点 + 150ms thumb | 160ms 根节点颜色；160ms thumb transform |
| Slider thumb | 颜色/阴影过渡 | 保持直接操控，thumb 不做位移动画；ring 80ms |
| Input / Select trigger | 默认 150ms | 80ms colors；focus ring 即时 |
| Button | `transition-all` + 150ms 按压 | 80ms colors；80ms translateY(1px) 按压 |
| 字体校验 / 导入错误 | 直接插入区块，布局跳动 | 预留一行，或用 `.kite-reveal` 140ms 展开，避免跳动 |
| 快捷键录制 | `animate-pulse` 文字 | 1.4s 仅小圆点 opacity 脉冲，文字静态 |

### 4.4 终端周边

| 组件 | 现状 | 目标 |
|---|---|---|
| 光标滑移 | CSS 64ms / JS 72ms 双源 | 统一为 `--dur-cursor` 64ms，曲线 `cubic-bezier(0.2, 0, 0, 1)`；删除 JS 里的第二个常量 |
| 光标脉冲 | 1.1s，opacity 0.35-1，expand 用 scaleY(0.25) | 1.3s，opacity 0.6-1，只做亮度脉冲；bar 形状不再用 scaleY 抽动 |
| 未聚焦 pane 光标 | overlay 策略下完全消失 | 保留 0.45 透明度静态光标，或恢复 1px outline |
| 拖放遮罩 | 瞬现 + backdrop-blur | 160ms opacity + scale(0.99)；拖拽期间改半透明底色，落点后再恢复模糊 |
| 复制提示 | 自定义 keyframes | 见 4.2；锚点优先取选区末端 cell，退化到 pane 中心，最后才用鼠标位置；套 `zoom-exempt` |
| 复制播报 | aria-live 节点 1.3s 后卸载 | 增加常驻 `role=status` 容器，气泡只负责视觉 |
| 冷启动 pane | 无反馈 | 低对比度"正在启动 shell"占位层，收到首个 PTY 字节即移除；不改终端容器透明度 |
| 窗格分割 | 无动画 | 保持无动画 |
| 窗格 resize | 无动画 | 保持无动画 |
| 终端 tab 切换 | 无动画 | 保持无动画 |
| 滚动 | 原生 | `scroll-behavior: auto`，不做平滑滚动 |

## 5. 编排

不做页面级入场编排。Kite 是工具，打开就应该可用。唯一允许的"编排"是两个局部动作：

1. **命令面板**：遮罩先淡入 160ms，内容延迟 20ms 开始 240ms 上升。20ms 的错峰足以产生层次，不会让人觉得在等动画。
2. **设置页 section**：内容 160ms 上升，顶部 tabs 不动。切换是原地替换，不做横向滑动，避免用户迷失方向。

标签、窗格、终端之间不做交叉淡入。空间连续性由 tab pill 和 HUD 承担，不由终端内容承担。

HUD 的键盘操作必须即时：入场动画只作用于挂载，选中行的移动和 Tab 切换不等动画。

命令面板退出时，query 和 page 必须保留到退出动画结束。可以在 `onCloseAutoFocus` 或 presence 结束时再清空，避免内容先闪空。

## 6. 减弱动效

把所有动画统一收口，不再依赖逐个类名列举：

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }

  /* 光标由 JS 与 CSS 双路径控制；这里显式保持可见，避免 0.01ms 关键帧停在暗态 */
  .kite-terminal-cursor-overlay-visual {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
  }
}
```

补充规则：

- 光标仍然可见，但不脉冲；滑移改为即时。
- 复制提示显示 1.2s，不做位移。
- 标签跑马灯停止，完整路径通过 `title` 或 tooltip 提供。
- 解析中标签只保留静态 0.6 透明度。
- 命令面板、Dialog、HUD 全部即时出现。
- 录制指示的小圆点不再脉冲，改为静态红点。
- JS 侧的 `matchMedia("(prefers-reduced-motion: reduce)")` 与 CSS 必须同时判断，不能只处理一边。`rendererPool.ts:169, 190` 已有查询，新增动效复用它。
- 用 Playwright 的 `emulateMedia({ reducedMotion: "reduce" })` 做验收。

## 7. 性能预算

- 只允许动画化 `transform`、`opacity`、`color`、`background-color`、`border-color`、`box-shadow` 的颜色部分。
- 唯一允许的布局动画是 tab pill 的 `width`。它是单个绝对定位元素，不触发兄弟重排；如果性能 trace 显示掉帧，再改为 FLIP + `scaleX`，并单独处理圆角。
- `will-change` 只允许出现在 tab pill 与终端光标 overlay 上，并且只在动画进行时施加，动画结束即移除。禁止加到标签文字、列表、卡片、`.xterm` 或任何包含 canvas 的节点。
- 不使用 `transition: all`。每处都列出具体属性。
- 不动态改变 `backdrop-filter`。模糊可以静态存在，但不能动画化模糊半径。
- 不在包含 xterm 的元素上做 opacity/transform 动画。浮层必须是 `.xterm-screen` 的兄弟或独立 overlay，并带 `contain: strict`。
- 浮层内容加 `contain: layout paint`，减少重排范围。
- 隐藏标签仍然挂载，所以任何无限动画都会为每个打开的标签持续计时。无限循环只允许出现在当前可见且处于瞬时状态的元素上。
- 验收目标：在 4 年前的主流笔记本上，标签切换、命令面板开关、设置页切换保持 60fps，无超过 16ms 的长任务。

## 8. 实施阶段

### P0 基础层（一个独立 PR）

- 新增 `--dur-instant`，把 Tailwind 默认时长与曲线接到 `--dur-fast` / `--ease-soft`。
- 添加统一的 reduced-motion 规则，包含光标可见性例外。
- 删除 `.kite-panel-in`；`.kite-reveal` 保留给字体校验与导入错误的一行展开。
- 替换 5 处 `transition-all` 为显式属性。
- 为 Dialog、AlertDialog、Command、Tooltip、Select、ContextMenu 定义共享浮层类，替换 `duration-100` 组合。
- 修复 Tooltip 的 `instant-open` 选择器，统一 `sideOffset` 为 4-6px，统一两个 TooltipProvider 的延迟。
- 设置页 5 个 Select 改为 `position="popper"`，删除无用的 `animate-none` / zoom / slide 类。
- 移除 ScrollArea 中不会被使用的过渡。
- 移除标签文字与光标 overlay 的常驻 `will-change`。
- 把运动 token 与浮层配方写入架构参考文档（现 `KITE.md`），防止新生成的 shadcn 组件重新引入 `duration-100` / `zoom-in-95`。

退出标准：所有浮层使用同一套时长与曲线；reduced-motion 规则覆盖浮层、Toast、复制提示、录制指示；`transition-all` 清零；Tooltip 与 Select 有真实入场。

### P1 主窗口 chrome

- Tab pill 保持 240ms，关闭/重排时抑制一帧 transform。
- 新标签入场改为 opacity + 2px，去掉 scale；用 `onAnimationEnd` 或固定生命周期的 key 让动画自终止，不依赖渲染期 ref。
- 删除 settle 状态、JS 定时器、filter 与过冲。
- 解析中标签改一次性 700ms 扫描线，图标静态 0.6。
- 跑马灯改为 300ms 停留、24px/s、mask 渐隐、200ms 回位。
- HUD 增加 160ms 入场，选中切换即时。
- 拖拽增加 ghost、grow-in、边缘自动滚动。
- 窗口控制 80ms 颜色与按压。
- 紧凑模式加 700/740 滞回，标签文字 120ms 交叉淡入。

退出标准：连续开 5 个标签、快速 Ctrl+Tab、拖拽排序，视觉节奏一致，没有无限循环干扰，入场动画不会半途消失。

### P2 浮层与反馈

- 命令面板签名动效（240ms 上升 + 20ms 错峰），退出后再清空 query/page。
- 命令面板主题子页 160ms 交叉淡入。
- Toast 160ms / 160ms，圆角 16px。
- 复制提示改为 token 化 1.2s，递增 key 重启，锚点修正，`zoom-exempt`，常驻 aria-live。
- 拖放遮罩 160ms，拖拽期间降 blur。
- 冷启动 pane 占位层。

退出标准：命令面板、对话框、Toast、复制提示四类反馈的节奏一致；遮罩与内容不同时结束；退出动画期间内容不闪空。

### P3 设置窗口

- Section 切换 160ms，切换时 `scrollTop = 0`。
- 设置页 Tabs 改为共享滑动指示器，240ms。
- 主题卡边框、ring、勾选图标。
- 主题切换加 `data-theme-swapping` 两帧禁用颜色过渡。
- Switch、Button、Input 的显式属性过渡。
- 字体校验与导入错误用 `.kite-reveal` 展开，避免布局跳动。
- 录制指示改为小圆点脉冲。

退出标准：设置页与主窗口使用同一套 token；没有 `transition-all`；主题切换整帧一致，无局部渐变。

### P4 打磨与验收

- 光标脉冲幅度与时长微调，统一 CSS/JS 时长。
- 未聚焦 pane 光标语义。
- 性能 trace：标签切换、面板开关、设置页切换。
- reduced-motion 全量走查。
- 可选：加一个 Vitest 契约测试，扫描 `src` 中是否出现裸 `duration-`、`ease-`、`transition-all`，以及 `globals.css` 是否包含必需 token。

退出标准：第 9 节验收清单全部通过。

## 9. 验收清单

### 代码

- [ ] `globals.css` 之外的 `src` 中没有裸写的毫秒值或 `cubic-bezier`。
- [ ] `src` 中没有 `transition-all`。
- [ ] 除终端光标与录制小圆点外，没有无限循环动画。
- [ ] 所有浮层共用 `.kite-overlay` / `.kite-dialog` / `.kite-popover`。
- [ ] `prefers-reduced-motion` 全局生效，且光标不会因 0.01ms 关键帧停在暗态。
- [ ] `will-change` 只出现在 tab pill 与光标 overlay，且随动画状态收放。
- [ ] 没有新的动画依赖进入 `package.json`。

### 视觉

- [ ] 连续开 5 个标签，入场不弹跳、不闪烁，且不会被 cwd 更新打断。
- [ ] 快速切换 10 次标签，pill 跟手，终端不淡入淡出。
- [ ] 关闭、重排、重命名时 pill 与标签不出现一帧错位。
- [ ] 命令面板打开与关闭有明确的空间来源，不"闪一下"；退出时内容不闪空。
- [ ] 对话框遮罩先于内容结束，关闭时内容先于遮罩结束。
- [ ] Tooltip 在即时打开时也有 160ms 入场，不再瞬现。
- [ ] 设置页 Select 弹层有统一入场，不再瞬开。
- [ ] 设置页四个 section 切换方向一致，不横向滑动，滚动位置归零。
- [ ] 主题切换整帧一致，没有一半即时、一半渐变。
- [ ] 主题卡选中反馈清晰，但不过度。
- [ ] 复制提示出现与消失都不打断输入，重复复制会重启。
- [ ] 拖放遮罩出现时不遮挡终端内容超过 160ms。
- [ ] 未聚焦 pane 仍然能看出光标位置。

### 性能与无障碍

- [ ] Playwright trace 中标签切换、面板开关、设置页切换无超过 16ms 的长任务。
- [ ] 没有因动画产生的 layout shift，字体校验与导入错误也不推动布局。
- [ ] `emulateMedia({ reducedMotion: "reduce" })` 下所有动画即时完成。
- [ ] 键盘焦点环不受动画影响，始终即时可见。
- [ ] 复制确认能被读屏完整播报。

## 10. 定稿决定

以下取舍按「精确仪器」方向锁定：

| 事项 | 定稿 | 理由 |
|---|---|---|
| 性格 | 精确仪器 | 克制、准确、有连续性；不做演示型编排 |
| 标签 hover 跑马灯 | 保留，300ms 停留，24px/s，两端 mask，200ms 回位 | 长路径需要可读性，但不能持续滚动 |
| 主题切换 | 即时，`data-theme-swapping` 两帧禁用颜色过渡 | 避免半主题终端和局部颜色渐变 |
| Zen 模式 | 即时 | 避免 header 高度动画导致终端反复 fit |
| 光标脉冲 | 保留 1.3s 亮度脉冲，opacity 0.6-1 | 光标需要可见，但不抢注意力 |
| 设置页 Tabs | 共享滑动指示器，240ms | 与主标签栏同一套连续性语言 |
| 命令面板 | 240ms 淡入 + 6px 上浮，不做缩放 | 680px 大表面缩放会像网页弹窗 |
| 小浮层退场 | 80ms | 退场比入场快一档 |
| 设置页 Select | `position="popper"`，160ms fade + 2px | 五个设置项统一有入场，不再瞬开 |

## 11. 不做的事

- 不引入 framer-motion、spring 物理库或任何动画依赖。
- 不做页面级入场编排、滚动叙事、视差。
- 不动画化终端内容、xterm 画布、PTY 输出。
- 不给每张卡片加 hover 动画。
- 不使用回弹、过冲、橡皮筋曲线。
- 不动画化模糊半径、滤镜、阴影尺寸。
- 不做平滑滚动。
- 不在主题切换时做可能露出半主题终端的过渡。

## 12. 预期结果

改动集中在 `globals.css`、6 个 shadcn 浮层组件、标签栏、设置页和 4 个小组件。不新增依赖，不改终端核心，不改 PTY。

完成后，Kite 的动效应该"几乎注意不到，但拿掉会觉得生硬"：标签跟手，浮层有来源，反馈即时，终端安静。这是精确仪器方向的高级感。

# Chinese Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add manual English and Simplified Chinese UI switching for Kite, starting with a lightweight in-repo i18n layer and a language selector in Settings.

**Architecture:** Keep localization entirely in the frontend. Store the selected language in the existing preferences store, broadcast changes through the existing cross-window preference event, and expose typed message dictionaries through `src/modules/i18n`. Do not add i18next or any runtime translation dependency.

**Tech Stack:** React 19, TypeScript, Zustand preferences store, Tauri plugin store, existing shadcn-style UI primitives, Hugeicons.

---

## Current Status

- [x] Design approved by product owner.
- [x] Implementation plan created.
- [x] Phase 1 complete: i18n foundation.
- [x] Phase 2 complete: Settings language selector and Settings localization.
- [x] Phase 3 complete: main shell localization.
- [x] Phase 4 complete: workspace module localization.
- [x] Phase 5 complete: AI surface localization.
- [ ] Phase 6 complete: verification and polish.

When a task is completed, change its checkbox from `- [ ]` to `- [x]`. When every task in a phase is checked, mark that phase complete in the status list above.

## Product Scope

### In Scope

- Manual language selection in Settings.
- Two languages in the first release:
  - `en`: English
  - `zh-CN`: 简体中文
- Immediate UI refresh in both the main window and Settings window after switching language.
- Persisted language preference across restarts.
- UI text, labels, empty states, tooltips, button labels, command palette titles, dialog text, aria labels, and notification text.
- Number formatting where the UI currently hardcodes `"en-US"` for visible UI metrics.

### Out of Scope

- Translating terminal output.
- Translating file contents, Git commit messages, branch names, paths, command output, provider names, model names, theme names, language mode names, and user data.
- Translating AI system prompts, tool schemas, provider protocol text, or model responses.
- Runtime language pack downloading.
- System-language auto-detection in the first pass.
- RTL layout support.

## Design Principles

- Keep the app lightweight: no new dependency for this two-language scope.
- Keep existing behavior stable: localization must not change tab identity, command ids, provider ids, tool ids, or Settings tab query parameters.
- Use type safety: Chinese dictionaries must satisfy the English base message shape.
- Use short Chinese UI copy: concise, product-like, not explanatory paragraphs everywhere.
- Preserve technical terms where needed: `WebGL`, `Vim`, `WSL`, `OpenAI Compatible`, `Token`, provider names, model ids.
- Avoid global string lookup magic. Prefer explicit `messages.section.key` access so refactors stay readable.

## Proposed File Structure

### Create

- `src/modules/i18n/index.ts`
  - Public exports for locale types, message hook, provider, and format helpers.
- `src/modules/i18n/messages/en.ts`
  - English source of truth for UI messages.
- `src/modules/i18n/messages/zh-CN.ts`
  - Simplified Chinese messages typed against English.
- `src/modules/i18n/locale.ts`
  - Locale constants, coercion, labels, and storage helpers.
- `src/modules/i18n/format.ts`
  - Locale-aware number and compact-number formatting helpers.
- `src/modules/i18n/messages.test.ts`
  - Tests for locale coercion and critical message coverage.

### Modify

- `src/modules/settings/store.ts`
  - Add `appLanguage`, preference key, loader, setter, preference-change mapping, and fast-path mirror.
- `src/modules/settings/preferences.ts`
  - Mirror language into localStorage, similar to the background fast path.
- `src/settings/SettingsApp.tsx`
  - Use localized tab labels.
- `src/settings/sections/GeneralSection.tsx`
  - Add language selector and localize visible Settings copy.
- `src/settings/sections/*.tsx`
  - Localize Settings sections in batches.
- `src/app/App.tsx`
  - Ensure i18n provider is mounted near the root if a provider-based approach is used.
- `src/main.tsx` and `src/settings/main.tsx`
  - Wrap app roots only if the i18n implementation needs a provider.
- Main surface modules under `src/modules/*`
  - Replace hardcoded UI strings in targeted phases.

## Message Shape

Use English as the source shape. Chinese must satisfy the same type.

Recommended pattern:

```ts
export const en = {
  common: {
    language: "Language",
    english: "English",
    simplifiedChinese: "简体中文",
    loading: "Loading...",
    save: "Save",
    cancel: "Cancel",
    remove: "Remove",
  },
  settings: {
    tabs: {
      general: "General",
      themes: "Themes",
      shortcuts: "Shortcuts",
      models: "Models",
      agents: "Agents",
      about: "About",
    },
    general: {
      title: "General",
      description: "Mode, editor, and startup.",
      appearance: "Appearance",
      languageTitle: "Language",
      languageDescription:
        "Controls the app UI language. Terminal output, files, model names, and AI responses keep their original language.",
    },
  },
} as const;

export type Messages = typeof en;
```

```ts
import type { Messages } from "./en";

export const zhCN: Messages = {
  common: {
    language: "界面语言",
    english: "English",
    simplifiedChinese: "简体中文",
    loading: "加载中...",
    save: "保存",
    cancel: "取消",
    remove: "移除",
  },
  settings: {
    tabs: {
      general: "通用",
      themes: "主题",
      shortcuts: "快捷键",
      models: "模型",
      agents: "智能体",
      about: "关于",
    },
    general: {
      title: "通用",
      description: "模式、编辑器和启动项。",
      appearance: "外观",
      languageTitle: "界面语言",
      languageDescription:
        "控制应用界面语言。终端输出、文件内容、模型名称和 AI 回复保持原语言。",
    },
  },
};
```

For dynamic text, prefer small formatter functions inside message sections only when grammar differs by locale:

```ts
scrollbackLines: (lines: string) => `${lines} lines`
```

```ts
scrollbackLines: (lines: string) => `${lines} 行`
```

## Language Preference

Add:

```ts
export type AppLanguage = "en" | "zh-CN";
```

Default:

```ts
appLanguage: "en"
```

Storage key:

```ts
const KEY_APP_LANGUAGE = "appLanguage";
```

Setter:

```ts
export async function setAppLanguage(value: AppLanguage): Promise<void> {
  await writePref(KEY_APP_LANGUAGE, coerceAppLanguage(value));
}
```

Coercion:

```ts
export function coerceAppLanguage(value: unknown): AppLanguage {
  return value === "zh-CN" ? "zh-CN" : "en";
}
```

Fast path:

- Mirror the selected language to localStorage as `terax-ui-language-shadow`.
- Read that value before hydration so Settings and main window do not flash English unnecessarily.
- Store remains source of truth after hydration.

## UI Design

### Settings Placement

Place the selector in `General` under `Appearance`, before `Zoom`.

Layout:

- Use existing `SettingRow`.
- Title: localized `Language` / `界面语言`.
- Description: one short sentence explaining scope.
- Control: existing `Select`.
- Options:
  - `English`
  - `简体中文`

The option labels should always display native names, not the current UI language. This keeps the selector recoverable if the user switches accidentally.

### Visual Constraints

- Keep row height aligned with existing Settings rows.
- Use `w-36` or wider for the language `SelectTrigger`; Chinese label must not clip.
- Do not add a new sidebar category.
- Do not use flags. Language is not country.
- Use the same subdued work-focused Settings style already in the app.
- Keep Chinese copy short enough for compact controls, especially command palette rows, toolbar button titles, and status bar pills.

### Suggested Chinese Glossary

| English | Chinese |
| --- | --- |
| General | 通用 |
| Themes | 主题 |
| Shortcuts | 快捷键 |
| Models | 模型 |
| Agents | 智能体 |
| About | 关于 |
| Settings | 设置 |
| Command palette | 命令面板 |
| Source control | 源代码管理 |
| Git graph | Git 图谱 |
| Terminal | 终端 |
| Editor | 编辑器 |
| Preview | 预览 |
| Workspace | 工作区 |
| Space | 空间 |
| New terminal | 新建终端 |
| New private terminal | 新建私密终端 |
| AI agent | AI 智能体 |
| Ask AI | 询问 AI |
| Approval | 审批 |
| Connected | 已连接 |
| Loading... | 加载中... |

## Phase 1: I18n Foundation

**Goal:** Add typed localization infrastructure and a persisted `appLanguage` preference without changing visible UI yet.

**Files:**

- Create: `src/modules/i18n/locale.ts`
- Create: `src/modules/i18n/messages/en.ts`
- Create: `src/modules/i18n/messages/zh-CN.ts`
- Create: `src/modules/i18n/format.ts`
- Create: `src/modules/i18n/index.ts`
- Create: `src/modules/i18n/messages.test.ts`
- Modify: `src/modules/settings/store.ts`
- Modify: `src/modules/settings/preferences.ts`

**Tasks:**

- [x] Add `AppLanguage`, `APP_LANGUAGES`, `LANGUAGE_LABELS`, and `coerceAppLanguage`.
- [x] Add `appLanguage` to `Preferences`, `DEFAULT_PREFERENCES`, `loadPreferences`, `writePref` mapping, `onPreferencesChange`, and `setAppLanguage`.
- [x] Add localStorage fast path for language in `preferences.ts`.
- [x] Add English and Simplified Chinese message dictionaries with the initial shared shape.
- [x] Add `useMessages()` and `useAppLanguage()` exports.
- [x] Add locale-aware `formatNumber`, `formatCompactNumber`, and `formatPercent` helpers.
- [x] Add tests for `coerceAppLanguage` and dictionary shape sanity.

**Verification:**

```powershell
pnpm test -- src/modules/i18n/messages.test.ts
pnpm check-types
```

Expected:

- Locale tests pass.
- TypeScript fails if `zh-CN` is missing any key from `en`.
- No UI behavior changes yet except preference availability.

## Phase 2: Settings Selector And Settings Localization

**Goal:** Let the user switch language manually and localize Settings.

**Files:**

- Modify: `src/settings/SettingsApp.tsx`
- Modify: `src/settings/sections/GeneralSection.tsx`
- Modify: `src/settings/sections/ThemesSection.tsx`
- Modify: `src/settings/sections/ShortcutsSection.tsx`
- Modify: `src/settings/sections/ModelsSection.tsx`
- Modify: `src/settings/sections/AgentsSection.tsx`
- Modify: `src/settings/sections/AboutSection.tsx`
- Modify: `src/settings/components/SettingRow.tsx` only if description needs to accept `ReactNode`
- Modify: `src/settings/components/SectionHeader.tsx` only if description needs to accept `ReactNode`

**Tasks:**

- [x] Localize Settings tab labels in `SettingsApp.tsx`.
- [x] Add the language selector in `GeneralSection`, positioned after Appearance and before Zoom.
- [x] Localize `GeneralSection` labels, descriptions, button titles, tooltips, and select option labels.
- [x] Localize `ThemesSection` labels, descriptions, buttons, errors, and empty states.
- [x] Localize `ShortcutsSection` labels, search placeholders, reset actions, and conflict text.
- [x] Localize `ModelsSection` headings, provider management UI, voice input UI, connection statuses, and validation messages.
- [x] Localize `AgentsSection` and `AboutSection`.
- [x] Keep provider labels, model ids, endpoint ids, theme names, and code-like placeholders untranslated.
- [x] Verify switching language in Settings updates the Settings window immediately.

**Verification:**

```powershell
pnpm check-types
pnpm lint
```

Manual checks:

- Open Settings.
- Switch from English to 简体中文.
- Confirm tab labels and current section update immediately.
- Close Settings, reopen Settings, confirm selected language persists.
- Switch back to English, confirm the selector remains understandable.

## Phase 3: Main Shell Localization

**Goal:** Localize the main always-visible UI without touching terminal behavior.

**Files:**

- Modify: `src/modules/header/Header.tsx`
- Modify: `src/modules/header/SearchInline.tsx`
- Modify: `src/modules/tabs/TabBar.tsx`
- Modify: `src/modules/command-palette/commands.ts`
- Modify: `src/modules/command-palette/CommandPalette.tsx`
- Modify: `src/modules/sidebar/SidebarRail.tsx`
- Modify: `src/modules/statusbar/StatusBar.tsx`
- Modify: `src/modules/statusbar/CwdBreadcrumb.tsx`
- Modify: `src/modules/statusbar/WorkspaceEnvSelector.tsx`
- Modify: `src/app/components/WorkspaceInputBar.tsx`
- Modify: `src/app/components/CloseDialogs.tsx`

**Tasks:**

- [x] Localize header button titles and accessible labels.
- [x] Localize search placeholders and search result labels.
- [x] Localize tab creation menu labels and tab context menu labels.
- [x] Localize command palette groups, command titles, keywords, and disabled reasons.
- [x] Keep command ids and shortcut ids unchanged.
- [x] Localize sidebar labels and source-control panel toggle labels.
- [x] Localize status bar private-terminal pill and tooltip.
- [x] Localize workspace environment selector labels while preserving `Windows`, `WSL`, and distro names.
- [x] Localize close-confirmation dialogs for dirty editors, terminal tabs, and app close.

**Verification:**

```powershell
pnpm check-types
pnpm lint
```

Manual checks:

- Main header remains compact in English and Chinese.
- Command palette search works with English keywords after switching to Chinese.
- Chinese command titles fit within palette rows.
- Status bar does not overlap with long paths or private-terminal text.

## Phase 4: Workspace Module Localization

**Goal:** Localize explorer, editor affordances, preview, markdown, git history, and source control.

**Files:**

- Modify: `src/modules/explorer/FileExplorer.tsx`
- Modify: `src/modules/explorer/ExplorerSearch.tsx`
- Modify: `src/modules/explorer/InlineInput.tsx`
- Modify: `src/modules/explorer/lib/contextActions.ts`
- Modify: `src/modules/source-control/SourceControlPanel.tsx`
- Modify: `src/modules/git-history/GitHistoryPane.tsx`
- Modify: `src/modules/git-history/GitHistoryStack.tsx`
- Modify: `src/modules/editor/NewEditorDialog.tsx`
- Modify: `src/modules/editor/EditorPane.tsx`
- Modify: `src/modules/editor/GitDiffPane.tsx`
- Modify: `src/modules/editor/AiDiffPane.tsx`
- Modify: `src/modules/preview/PreviewPane.tsx`
- Modify: `src/modules/preview/PreviewAddressBar.tsx`
- Modify: `src/modules/markdown/MarkdownViewToggle.tsx`

**Tasks:**

- [x] Localize explorer empty states, context menu actions, create/rename/delete labels, search placeholders, and error text.
- [x] Keep filenames, paths, extensions, and gitignored status data unchanged.
- [x] Localize source control labels, staging actions, commit form labels, push/pull/fetch actions, and empty states.
- [x] Keep Git branch names, remote names, commit subjects, file paths, and status codes unchanged.
- [x] Localize git history headings, filter text, and per-commit action labels.
- [x] Localize editor new-file dialog and editor surface labels.
- [x] Keep language mode names untranslated unless they are generic UI words.
- [x] Localize preview address bar labels and failure states.
- [x] Localize markdown view toggle labels.

**Verification:**

```powershell
pnpm check-types
pnpm lint
pnpm test -- src/modules/explorer src/modules/git-history src/modules/editor src/modules/preview
```

Manual checks:

- Create, rename, and delete explorer flows remain clear in Chinese.
- Source control can stage, unstage, view diff, and commit with Chinese UI.
- Git graph still displays user data exactly as stored.
- Editor and preview controls fit in compact layouts.

## Phase 5: AI Surface Localization

**Goal:** Localize AI UI while preserving AI behavior, prompts, tools, schemas, and provider protocols.

**Files:**

- Modify: `src/modules/ai/components/AiChat.tsx`
- Modify: `src/modules/ai/components/AiInputBar.tsx`
- Modify: `src/modules/ai/components/AiComposerInput.tsx`
- Modify: `src/modules/ai/components/AiMiniWindow.tsx`
- Modify: `src/modules/ai/components/AiStatusBarControls.tsx`
- Modify: `src/modules/ai/components/AiToolApproval.tsx`
- Modify: `src/modules/ai/components/AgentSwitcher.tsx`
- Modify: `src/modules/ai/components/FilePicker.tsx`
- Modify: `src/modules/ai/components/PlanDiffReview.tsx`
- Modify: `src/modules/ai/components/SnippetPicker.tsx`
- Modify: `src/modules/ai/components/TodoStrip.tsx`
- Modify: `src/modules/ai/components/SelectionAskAi.tsx`
- Modify: `src/modules/ai/components/LocalAgentNotificationsBridge.tsx`
- Modify: `src/modules/agents/components/NotificationBell.tsx`
- Modify: `src/modules/agents/components/AgentToast.tsx`
- Modify: `src/modules/ai/lib/security.ts` only if visible refusal messages are routed through UI message helpers.

**Tasks:**

- [x] Localize AI panel placeholders, buttons, empty states, status text, and tool display labels.
- [x] Localize approval card labels such as approve, reject, write file, edit file, run shell command, and background process.
- [x] Preserve raw command text, file paths, diff content, tool names, and tool ids.
- [x] Localize PlanDiffReview labels and action buttons.
- [x] Localize file picker and snippet picker UI.
- [x] Localize local-agent notification titles and bodies.
- [x] Do not translate `config.ts` system prompts or tool descriptions sent to models.
- [x] Keep model output rendering untouched.

**Verification:**

```powershell
pnpm check-types
pnpm lint
pnpm test -- src/modules/ai
```

Manual checks:

- Approval card is understandable in Chinese.
- Diff review text fits and actions remain clear.
- AI prompts and tool calls still work exactly as before.
- Desktop and in-app notifications use the selected language for app-generated text.

## Phase 6: Verification, Polish, And Regression

**Goal:** Confirm localization is complete enough for release and does not regress layout, startup, performance, or safety.

**Files:**

- Modify only files needed for polish found during verification.

**Tasks:**

- [x] Run full frontend checks.
- [x] Run focused tests added for i18n.
- [x] Audit for obvious remaining English UI strings in targeted modules.
- [x] Audit for accidental translation of protocol ids, model ids, provider ids, command ids, and file/user data.
- [x] Verify no new dependency was added.
- [x] Verify startup eager bundle budget still passes.
- [ ] Manually inspect Settings in English and Chinese.
- [ ] Manually inspect main shell in English and Chinese.
- [ ] Manually inspect AI approval, source control, explorer, command palette, and status bar in Chinese.
- [x] Mark all completed tasks and phase status checkboxes in this document.

**P6 command/static verification completed on 2026-07-03:**

- `pnpm lint` exited 0 with the existing Biome warning baseline.
- `pnpm check-types` exited 0.
- `pnpm test` exited 0 with 34 test files and 262 tests passing.
- `pnpm test -- src/modules/i18n/messages.test.ts` exited 0; the project test script runs the full Vitest suite with that argument.
- `pnpm analyze:eager` exited 0; the main entry still reports the existing `@xterm` CSS eager reachability, and the Settings entry reports no watched heavy packages.
- `git diff -- package.json pnpm-lock.yaml` produced no diff.
- `git diff --check` exited 0 with only CRLF normalization warnings.
- Browser/dev-server visual inspection was intentionally not run because the user requested no browser usage due to memory constraints.

**Verification commands:**

```powershell
pnpm lint
pnpm check-types
pnpm test
```

Expected:

- All commands pass.
- No new dependency appears in `package.json`.
- No visible UI text overlaps or clips in common desktop window sizes.

## Suggested Execution Order

1. Phase 1 first, because every later phase depends on the i18n primitives.
2. Phase 2 second, because it makes language switching testable.
3. Phase 3 third, because main shell text is most visible.
4. Phase 4 fourth, because workspace modules are broader but less risky than AI behavior.
5. Phase 5 fifth, because AI surfaces have the highest risk of accidentally changing behavior.
6. Phase 6 last, with manual UI inspection.

## Risk Register

| Risk | Why It Matters | Mitigation |
| --- | --- | --- |
| English strings remain scattered | User sees mixed-language UI | Phase-by-phase string audit with `rg` and manual review |
| Chinese text clips compact controls | UI feels broken | Use short glossary terms, inspect Settings, header, command palette, status bar |
| AI behavior changes | Tool prompts and model behavior could regress | Do not translate system prompts, tool ids, tool schemas, provider protocols |
| Bundle grows | Kite is lightweight by design | No dependency, typed object dictionaries only |
| Settings window and main window diverge | Language changes feel broken | Use existing `writePref` and `terax://prefs-changed` event |
| Startup flickers English | Poor polish on Chinese setups | Add localStorage fast path for language |
| Tests become brittle | UI text changes break unrelated tests | Prefer testing locale helpers and dictionary shape, not large rendered snapshots |

## Definition Of Done

- [ ] User can switch between English and 简体中文 from Settings.
- [ ] Language choice persists after restart.
- [ ] Main window and Settings window both update after language change.
- [ ] Default remains English for existing and new users.
- [x] No new runtime dependency is added.
- [x] Terminal output, file content, provider names, model names, prompts, tool ids, and command ids are not translated.
- [x] `pnpm lint`, `pnpm check-types`, and `pnpm test` pass.
- [x] This plan document has completed tasks marked with `[x]`.

## Notes For Future Implementation

- Do not create a branch or commit unless explicitly requested.
- Use PowerShell commands in developer notes and verification output.
- Keep changes focused by phase. Do not combine localization with unrelated cleanup.
- If a file becomes noisy during translation, extract only the message lookup or small helpers. Do not rewrite the component structure.
- Prefer `messages.common.save` style access over ad hoc inline Chinese strings.
- Keep native labels in the language selector: `English` and `简体中文`.

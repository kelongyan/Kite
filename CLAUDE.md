# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Full dev (Vite HMR + Tauri shell)
pnpm tauri dev

# Production build + native installer
pnpm tauri build

# Frontend-only (no Tauri, faster iteration on UI)
pnpm dev

# Type check
pnpm check-types

# Lint / format
pnpm lint           # biome lint ./src
pnpm lint:fix       # biome lint --write ./src
pnpm format         # biome format --write ./src

# Frontend tests (Vitest)
pnpm test                                       # one-shot run
pnpm test:watch                                 # watch mode
pnpm test -- src/modules/terminal/lib/foo.test.ts  # single file

# Rust tests + lint (run from src-tauri/)
cargo test --locked
cargo clippy --all-targets --locked -- -D warnings

# Bundle analysis
pnpm analyze:bundle   # produces stats.html treemap
```

## Architecture

Kite is a Tauri 2 desktop app: **Rust backend** (`src-tauri/`) + **React 19 / TypeScript frontend** (`src/`). There are **two Vite entry points**: `index.html` (main app, `src/main.tsx`) and `settings.html` (settings window, `src/settings/main.tsx`).

### Frontend modules (`src/modules/`)

| `tabs` | All tab state (`useTabs` hook), tab bar, tab switcher HUD, pane tree logic |
| `terminal` | xterm.js integration, PTY bridge, block mode, split panes, clipboard |
| `editor` | CodeMirror 6 file editor |
| `explorer` | File tree sidebar |
| `source-control` | Git staging/commit panel |
| `git-history` | Git log viewer |
| `sftp` | SFTP browser (uses Rust libssh2) |
| `preview` | WebView/URL preview tab |
| `markdown` | Rendered markdown tab |
| `settings` | Preferences Zustand store and types (UI lives in `src/settings/`) |
| `spaces` | Workspace spaces (named groups of tabs with independent env/cwd) |
| `shortcuts` | Global keyboard shortcut registry |
| `command-palette` | Cmd+K palette |
| `workspace` | Workspace root path and environment context |
| `theme` / `sidebar` / `statusbar` / `header` / `i18n` | Layout and UI chrome |

### Rust backend modules (`src-tauri/src/modules/`)

`pty` (PTY sessions via portable-pty), `shell` (background processes, history), `fs` (file ops, grep via ripgrep crates, file watcher), `git` (git operations via shell commands), `sftp` (SSH2/SFTP), `history` (shell history parse), `workspace`, `proc`.

### IPC pattern

All Rust↔frontend calls use Tauri's `invoke()` and `Channel<T>`. Tauri commands are snake_case (`pty_open`, `fs_read_file`, `git_status`, etc.). PTY data streams as `Channel<ArrayBuffer>` — raw binary, no base64 overhead.

### Tab system

Seven tab kinds: `TerminalTab | EditorTab | PreviewTab | MarkdownTab | GitDiffTab | GitHistoryTab | GitCommitFileDiffTab | SftpTab`.

`TerminalTab` has sub-mode: `blocks: true` (block output UI). Each terminal tab holds a **pane tree** (binary split tree of `PaneNode`), capped at `MAX_PANES_PER_TAB = 4` (matches the shared WebGL renderer pool size).

Tabs are **cold by default** — shells only spawn on first activation. This is controlled by a `booted` flag to prevent spurious shell spawns during workspace restore.

## Code conventions

- **Biome** for linting and formatting: 2-space indent, double quotes, trailing commas, 80-char line width.
- `useImportType` / `useExportType` are errors — always use `import type` / `export type` for type-only imports.
- `src/components/ui/**` is shadcn-generated — excluded from lint.
- Import order: Node builtins → `@/**` aliases → npm packages → relative paths.
- Rust: `edition = "2021"`, incremental dev builds, fat LTO + `opt-level = "s"` for release.

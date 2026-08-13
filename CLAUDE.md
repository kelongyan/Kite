# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Full dev (Vite HMR + Tauri shell)
pnpm tauri dev

# Frontend-only (no Tauri, faster iteration on UI)
pnpm dev

# Production build + native installer
pnpm tauri build

# Frontend type check (tsc --noEmit, separate from Vite's bundler)
pnpm check-types

# Lint / format (Biome, 2-space indent, double quotes, trailing commas, 80-char)
pnpm lint           # biome lint ./src
pnpm lint:fix       # biome lint --write ./src
pnpm format         # biome format --write ./src

# Frontend tests (Vitest)
pnpm test                                        # one-shot run
pnpm test:watch                                  # watch mode
pnpm test -- src/modules/terminal/lib/foo.test.ts  # single file

# Rust tests + lint (run from src-tauri/)
cargo test --locked
cargo nextest run --locked       # CI uses nextest, not cargo test
cargo clippy --all-targets --locked -- -D warnings

# Bundle analysis
pnpm build               # tsc && vite build
pnpm analyze:bundle      # produces stats.html treemap
pnpm analyze:eager       # traces heavy deps in the eager graph (bundle regression check)
pnpm size                # size-limit
pnpm knip                # dead-code scan

# Full check in CI order: lint → typecheck → test → build → size → knip
pnpm lint && pnpm check-types && pnpm test && pnpm build && pnpm size && pnpm knip
```

**pnpm only** — never npm, npx, or yarn. `--frozen-lockfile` in CI.

## Architecture

Kite is a Tauri 2 desktop app: **Rust backend** (`src-tauri/`) + **React 19 / TypeScript frontend** (`src/`). There are **two Vite entry points**: `index.html` (main app, `src/main.tsx`) and `settings.html` (settings window, `src/settings/main.tsx`).

### Process boundary

Rust owns all OS access. The webview never touches shells, processes, Git, SFTP, or the filesystem directly — everything goes through Tauri commands registered in `src-tauri/src/lib.rs` (snake_case: `pty_open`, `fs_read_file`, `git_status`, …). PTY data streams as `Channel<ArrayBuffer>` — raw binary, no base64 overhead.

### Frontend modules (`src/modules/`)

| `tabs` | All tab state (`useTabs` hook), tab bar, tab switcher HUD, pane tree logic |
| `terminal` | xterm.js integration, PTY bridge, split panes, renderer pool, clipboard |
| `editor` | CodeMirror 6 file editor |
| `explorer` | Lightweight cwd directory navigator |
| `source-control` | Git staging/commit panel |
| `sftp` | SFTP browser (uses Rust libssh2) |
| `markdown` | Rendered markdown tab |
| `settings` | Preferences Zustand store and types (UI lives in `src/settings/`) |
| `shortcuts` | Global keyboard shortcut registry |
| `command-palette` | Cmd+K palette |
| `workspace` | Workspace root path and environment context |
| `theme` / `sidebar` / `statusbar` / `header` / `i18n` | Layout and UI chrome |

### Rust backend modules (`src-tauri/src/modules/`)

`pty` (PTY sessions via portable-pty), `fs` (directory listing, file read/write, create/delete helpers), `git` (git operations via child processes), `sftp` (SSH2/SFTP), `history` (shell history parse), `workspace`, `proc`, `secrets`.

### Tab system

Five tab kinds: `TerminalTab | EditorTab | MarkdownTab | GitDiffTab | SftpTab`.

Each terminal tab holds a **pane tree** (binary split tree of `PaneNode`), capped at `MAX_PANES_PER_TAB = 4`.

Tabs are **cold by default** — shells only spawn on first activation. This is controlled by a `booted` flag to prevent spurious shell spawns during workspace restore. Hidden tabs stay mounted and alive (PTYs and editors keep state) — do not assume unmount-on-switch.

## Critical gotchas

- **React 19 Strict Mode mounts effects twice in dev** — an initial PTY may open and close before the real session starts. Do not "fix" this; it's expected.
- **`SPAWN_LOCK`** serializes `openpty + spawn_command` on Windows. Removing it stalls concurrent ConPTY sessions.
- **Enter is sent as carriage return (`\r`)**, not line feed.
- **Windows sessions use a Job Object with kill-on-close** so child process trees don't survive Kite exiting.
- **Path separators**: `tab.cwd` originates from OSC 7 and uses forward slashes; `homeDir()` on Windows returns backslashes. Normalize at the frontend boundary — Rust fs callers must accept both `/` and `\`.
- **Shell bootstrap scripts** (`src-tauri/src/modules/pty/scripts/`) emit OSC 7 (cwd tracking) and OSC 133 A/B/C/D (prompt/command boundaries).
- **`src-tauri/tests/`** are integration tests that need Tauri runtime context.
- **Tailwind v4 config lives in `src/styles/globals.css`** (CSS-based, not tailwind.config).
- **Theme engine is custom**, not `next-themes`; built-ins under `src/modules/theme/themes/`. Legacy `terax-*` store keys are read-only migration fallbacks; new state is written under `kite-*`.
- **SFTP secrets never live in the frontend**: Windows/macOS use the OS credential store (`keyring`), Linux an app-local `secrets.json` (mode 0600). Never log credential values.

## Testing requirements

Changes to these load-bearing paths **must add or extend a test** that locks the invariant: shell/terminal spawn, workspace authorization (both allow and deny), Git command layer, filesystem mutation (atomic writes, symlinks, no data loss), IPC command surface, and pure logic with wide reach (cwd inheritance, tab/split tree transforms, OSC/prompt parsing). UI rendering, themes, and syntax-highlight tables do not need tests.

## Code conventions

- **Biome** for linting and formatting: 2-space indent, double quotes, trailing commas, 80-char line width.
- `useImportType` / `useExportType` are errors — always use `import type` / `export type` for type-only imports.
- `src/components/ui/**` is shadcn-generated but remains covered by lint and dead-code scans.
- Import order: Node builtins → `@/**` aliases → npm packages → relative paths.
- Rust: `edition = "2021"`, incremental dev builds, fat LTO + `opt-level = "s"` for release.
- No em dashes or emojis in code, comments, commits, or docs.

## Reference docs

- `TERAX.md` — living architecture reference; read before making changes and keep it aligned with structural changes.
- `ROADMAP.md` — scope and direction; read before opening anything non-trivial.
- `CONTRIBUTING.md` — solo-maintained project; alignment matters more than volume, keep PRs focused.

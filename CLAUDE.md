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
cargo nextest run --locked       # CI uses nextest, not cargo test
cargo test --locked              # works too, if nextest is unavailable
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

Rust owns all OS access. The webview never touches shells, processes, or the
filesystem directly — everything goes through Tauri commands registered in
`src-tauri/src/lib.rs` (snake_case: `pty_open`, `list_subdirs`,
`workspace_authorize`, …). PTY data streams as `Channel<ArrayBuffer>` — raw
binary, no base64 overhead. `pty_write` goes further: raw request body plus an
`x-pty-id` header, so a keystroke costs no JSON round-trip.

`WorkspaceRegistry` is bookkeeping, not a sandbox. `authorize` accepts any
canonicalizable path, `is_authorized` has no non-test caller, and `list_subdirs`
reads whatever path the webview sends. What is actually enforced:
CSP, the capability allowlist, `sanitize_shell_override` (an override must match
an enumerated shell), and `validate_wsl_distro_name`.

### Frontend modules (`src/modules/`)

| Module | Responsibility |
|---|---|
| `tabs` | All tab state (`useTabs` hook), tab bar, tab switcher HUD, pane tree logic |
| `terminal` | xterm.js integration, PTY bridge, split panes, renderer pool, clipboard |
| `settings` | Preferences Zustand store and types (UI lives in `src/settings/`) |
| `shortcuts` | Global keyboard shortcut registry |
| `command-palette` | Mod+P palette |
| `workspace` | Workspace root path and environment context |
| `theme` / `statusbar` / `header` / `i18n` | Layout and UI chrome |

There is no file explorer or sidebar: the window is header, terminal surface,
statusbar. Directory navigation is the statusbar cwd breadcrumb, which sends `cd`
to the focused terminal.

`i18n` ships a single locale (`zh-CN`) and has no switching.

### Rust backend modules (`src-tauri/src/modules/`)

`pty` (PTY sessions via portable-pty), `fs` (subdirectory listing for the
statusbar breadcrumb, plus the canonical path helper), `workspace`, `proc`.

### Tab system

The only tab kind is `TerminalTab`.

Each terminal tab holds a **pane tree** capped at `MAX_PANES_PER_TAB = 4`. Split
nodes hold an n-ary `children` array, not a fixed pair: splitting along an
existing split's direction appends a sibling rather than nesting, which keeps
resize handles aligned.

Tabs are **cold by default** — shells only spawn on first activation, gated by a
`booted` flag so no shell starts before the launch cwd resolves. Hidden tabs stay
mounted and alive (PTYs keep state) — do not assume unmount-on-switch. Tabs are
**not** persisted across launches; each start opens one tab, and new tabs open at
home rather than inheriting the active tab's cwd.

## Critical gotchas

- **React 19 Strict Mode mounts effects twice in dev.** The session record lives in a module `Map` keyed by leaf id, and the first mount's attach is skipped by a `cancelled` flag, so the double mount does not open a second PTY. Do not "fix" the double mount itself; it's expected.
- **`CONPTY_LIFECYCLE_LOCK`** (`pty/session.rs`) serializes ConPTY create *and* close on Windows. Removing it lets overlapping pseudoconsole lifecycle calls corrupt a new console so its shell never pumps output.
- **Windows sessions use a Job Object with kill-on-close** so child process trees don't survive Kite exiting. `Session` field order is load-bearing: `_job` is declared before `master` so kill-on-close fires before `ClosePseudoConsole`.
- **The renderer pool holds 5 slots, globally, across all tabs** — two tabs of 4 panes means cross-tab eviction, which is normal and handled. Do not reset a terminal when the dormant ring overflows: the notice deliberately carries no `ESC c`, because a reset would erase the snapshot replayed just before the drain.
- **OSC 7 is only honored between commands.** Command stdout is untrusted (remote SSH, `cat` of a hostile file), so the cwd handler returns early while `inCommand` is set.
- **Path separators**: `tab.cwd` originates from OSC 7 and uses forward slashes; `homeDir()` on Windows returns backslashes. Normalize at the frontend boundary — Rust fs callers must accept both `/` and `\`.
- **Shell bootstrap scripts** (`src-tauri/src/modules/pty/scripts/`) emit OSC 7 (cwd tracking) and OSC 133 A/B/C/D (prompt/command boundaries). Generated copies are written atomically under `~/.cache/kite/shell-integration/`.
- **`src-tauri/tests/`** call the command functions directly as plain Rust; no Tauri runtime needed.
- **Tailwind v4 config lives in `src/styles/globals.css`** (CSS-based, not tailwind.config).
- **Theme engine is custom**, not `next-themes`; six built-ins under `src/modules/theme/themes/`. Legacy `terax-*` store keys are read-only migration fallbacks; new state is written under `kite-*`.

## Testing requirements

Changes to these load-bearing paths **must add or extend a test** that locks the invariant: shell/terminal spawn, the workspace and WSL path layer (including the reject side of the distro-name validator), IPC command surface, and pure logic with wide reach (cwd inheritance, tab/split tree transforms, OSC/prompt parsing). UI rendering and themes do not need tests.

Known gap: `src/modules/terminal/lib/panes.ts` has no tests despite being on that list.

## Code conventions

- **Biome** for linting and formatting: 2-space indent, double quotes, trailing commas, 80-char line width.
- `useImportType` / `useExportType` are errors — always use `import type` / `export type` for type-only imports.
- `src/components/ui/**` is shadcn-generated but remains covered by lint and dead-code scans.
- Import order (Biome `organizeImports`): Node builtins → `@/**` aliases → npm packages → tsconfig aliases → relative paths. Note `@/**` sorts *before* npm packages.
- Rust: `edition = "2021"`, incremental dev builds, fat LTO + `opt-level = "s"` for release, plus a `release-lowmem` profile (thin LTO, 4 codegen units).
- No em dashes or emojis in code, comments, commits, or docs.

## Reference docs

- `TERAX.md` — living architecture reference; read before making changes and keep it aligned with structural changes.
- `ROADMAP.md` — scope and direction; read before opening anything non-trivial.
- `CONTRIBUTING.md` — solo-maintained project; alignment matters more than volume, keep PRs focused.

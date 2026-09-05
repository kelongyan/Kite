# AGENTS.md

Kite is a Tauri 2 desktop app: Rust backend (`src-tauri/`) + React 19 / TypeScript frontend (`src/`).

## First reads

- **`TERAX.md`** — living architecture reference. Read before making changes.
- **`CLAUDE.md`** — commands, architecture, conventions. Keep in sync.
- **`src-tauri/src/lib.rs`** — all Tauri commands registered here.
- **`src/app/App.tsx`** — frontend coordinator.

## Verification (non-obvious commands)

```sh
# frontend-only dev (no Tauri, HMR only)
pnpm dev

# full stack
pnpm tauri dev

# checks in CI order: lint → typecheck → test → build → size → knip
pnpm lint && pnpm check-types && pnpm test && pnpm build && pnpm size && pnpm knip

# single test file
pnpm test -- src/modules/terminal/lib/foo.test.ts

# Rust (run from src-tauri/)
cargo nextest run --locked           # CI uses nextest; cargo test --locked also works
cargo clippy --all-targets --locked -- -D warnings
```

## Caveats an agent would miss

- **Two Vite entrypoints**: `index.html` (main app, `src/main.tsx`) and `settings.html` (settings, `src/settings/main.tsx`).
- **pnpm only** — never npm, npx, or yarn. `--frozen-lockfile` in CI.
- **React 19 Strict Mode** mounts effects twice in dev. The terminal session record lives in a module `Map` keyed by leaf id and the first mount's attach is skipped by a `cancelled` flag, so the double mount does not open a second PTY.
- **`CONPTY_LIFECYCLE_LOCK`** (`src-tauri/src/modules/pty/session.rs`) serializes ConPTY create *and* close on Windows. Removing it lets overlapping pseudoconsole lifecycle calls corrupt a new console so its shell never pumps output.
- **The renderer pool is 5 slots, shared across all tabs**, while a tab allows 4 panes. Cross-tab eviction is normal and handled.
- **Path separators**: frontend uses forward slashes; `homeDir()` on Windows returns backslashes — normalize at the frontend boundary.
- **Tauri commands are `snake_case`** (`pty_open`, `list_subdirs`, `workspace_authorize`, etc.).
- **Tabs stay mounted when hidden** — PTYs keep state. Do not assume unmount-on-switch. Tabs are not persisted across launches.
- **`WorkspaceRegistry` is bookkeeping, not a sandbox**: `is_authorized` has no non-test caller and `list_subdirs` reads whatever path the webview sends. The enforced boundary is CSP + capabilities + `sanitize_shell_override` + `validate_wsl_distro_name`.
- **No file explorer or sidebar** — the window is header, terminal surface, statusbar. Directory navigation is the statusbar cwd breadcrumb.
- **`src-tauri/tests/`** call the command functions directly as plain Rust; no Tauri runtime needed.
- **`tsc --noEmit`** for type-checking (separate from Vite's bundler).
- **`pnpm analyze:eager`** traces heavy dependencies in the eager graph — useful for bundle regression checks.
- **Only one locale ships** (`src/modules/i18n/messages/zh-CN.ts`); `useMessages()` returns it unconditionally.

## File structure shorthand

| Path | Purpose |
|------|---------|
| `src/modules/<area>/` | Feature modules (terminal, tabs, theme, statusbar, etc.) |
| `src-tauri/src/modules/` | Rust backend (pty, fs, workspace, proc) |
| `src/styles/globals.css` | Tailwind v4 config and theme CSS variables |
| `src/components/ui/` | shadcn/ui components (linted, covered by dead-code scans) |
| `scripts/eager-graph.mjs` | Eager import tracer for bundle analysis |
| `src/app/eager-budget.test.ts` | Asserts the eager graph stays free of heavy stacks |

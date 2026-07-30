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
cargo nextest run --locked           # CI uses nextest, not cargo test
cargo clippy --all-targets --locked -- -D warnings
```

## Caveats an agent would miss

- **Two Vite entrypoints**: `index.html` (main app, `src/main.tsx`) and `settings.html` (settings, `src/settings/main.tsx`).
- **pnpm only** — never npm, npx, or yarn. `--frozen-lockfile` in CI.
- **React 19 Strict Mode** mounts effects twice in dev — an initial PTY may open and close before the real session starts.
- **`SPAWN_LOCK`** serializes `openpty + spawn_command` on Windows. Removing it stalls concurrent ConPTY sessions.
- **Path separators**: frontend uses forward slashes; `homeDir()` on Windows returns backslashes — normalize at the frontend boundary.
- **Tauri commands are `snake_case`** (`pty_open`, `fs_read_file`, `git_status`, etc.).
- **Tabs stay mounted when hidden** — PTYs and editors keep state. Do not assume unmount-on-switch.
- **`src-tauri/tests/`** are integration tests that need Tauri runtime context.
- **`tsc --noEmit`** for type-checking (separate from Vite's bundler).
- **`pnpm analyze:eager`** traces heavy dependencies in the eager graph — useful for bundle regression checks.
- **No repo-local `opencode.json`** — global config is at `~/.config/opencode/opencode.json`.

## File structure shorthand

| Path | Purpose |
|------|---------|
| `src/modules/<area>/` | Feature modules (terminal, editor, explorer, tabs, etc.) |
| `src-tauri/src/modules/` | Rust backend (pty, fs, git, sftp, history, workspace) |
| `src/styles/globals.css` | Tailwind v4 config and theme CSS variables |
| `src/components/ui/` | shadcn/ui components (linted, covered by dead-code scans) |
| `scripts/eager-graph.mjs` | Eager import tracer for bundle analysis |

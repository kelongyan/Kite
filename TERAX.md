# TERAX.md

The living architecture reference. Read it before making changes and keep it
aligned with structural changes. Coding assistants pick it up through
`.coderabbit.yaml`'s knowledge base and their own instruction-file discovery;
no application code reads this file.

## Project

Kite is an open-source, lightweight, cross-platform terminal emulator.

- Desktop runtime: Tauri 2
- Backend: Rust 2021, `portable-pty`
- Frontend: React 19, TypeScript, Vite, xterm.js
- Package manager: pnpm only
- Bundle id: `app.kelongyan.kite`
- Platforms: macOS, Linux, Windows, including WSL workspaces

Common gates:

```text
pnpm lint
pnpm check-types
pnpm test
pnpm build
pnpm analyze:eager
pnpm size
pnpm knip

cd src-tauri
cargo check --all-targets --locked
cargo clippy --all-targets --locked -- -D warnings
cargo nextest run --locked
```

## Quality Bar

- Correctness: handle edge cases, failures, and concurrent access.
- Performance: avoid unnecessary IPC, renders, memory, and dependencies.
- Security: validate IPC, filesystem, and process boundaries.
- UI/UX: keep every state polished, accessible, and platform appropriate.
- Architecture: put new logic in pure, dependency-light functions and keep
  Tauri commands and React components thin.

Changes to terminal spawning, the workspace and WSL path layer, or the IPC
surface need tests that lock the relevant invariant.

## Conventions

- Comments explain why, not what. Prefer self-explanatory code.
- Do not use em dashes or emojis in code, comments, commits, or docs.
- Frontend imports across modules use `@/...`.
- Use pnpm, never npm, npx, or yarn.
- Normalize cross-platform paths at boundaries. Frontend canonical paths use
  forward slashes and path splitting must accept both `/` and `\`.

## Process Boundary

Rust under `src-tauri/` owns operating-system access. The webview does not
touch shells, processes, or the local filesystem directly. Calls go
through commands registered in `src-tauri/src/lib.rs`; streaming uses Tauri
channels and events.

Backend command groups:

- `pty::*`: open, write, resize, close, close-all, foreground-process and
  foreground-job checks, shell list.
- `fs::tree::list_subdirs`: subdirectory listing for the statusbar cwd
  breadcrumb.
- `workspace::*`: authorization, current directory, WSL list and home.
- `get_launch_dir`: drains the CLI launch directory on first read.
- `open_settings_window`: creates or focuses the separate settings webview.

Do not add a command only to expose an internal helper.

`WorkspaceRegistry` records canonicalized directories the app has touched. It
is a bookkeeping registry, not a sandbox: `authorize` accepts any path that
canonicalizes, and `is_authorized` currently has no non-test caller. A cwd
handed to `pty_open` is registered rather than checked against existing roots
(`authorize_user_spawn_cwd`), and `list_subdirs` reads whatever path the webview
passes. Treat the enforced boundary as: the CSP, the capability allowlist,
`sanitize_shell_override` (a shell override must match an enumerated shell), and
`validate_wsl_distro_name` (every `wsl.exe` argv). A process spawned in the PTY
is unconstrained by design.

## PTY And Shell Integration

PTY sessions are managed by `PtyState` and `portable-pty`. Shell bootstrap
scripts live in `src-tauri/src/modules/pty/scripts/` and emit:

- OSC 7 for cwd tracking.
- OSC 133 A/B/C/D for prompt and command boundaries.

Platform rules:

- Unix shells use injected zsh, bash, or fish initialization.
- Windows prefers `pwsh.exe`, then `powershell.exe`, then `cmd.exe`. Git Bash is
  offered when a Git for Windows install is found.
- Windows cwd values are normalized before ConPTY spawn.
- `CONPTY_LIFECYCLE_LOCK` serializes ConPTY create and close on Windows.
  Removing it lets overlapping pseudoconsole lifecycle calls corrupt a new
  console so its shell never pumps output.
- Each Windows session uses a Job Object with kill-on-close so child process
  trees do not survive Kite unexpectedly.
- Generated init scripts are written atomically under
  `~/.cache/kite/shell-integration/` (WSL writes into the distro's own home).
- `da_filter` answers DA1/DA2 and a single startup cursor-position query inline,
  because a shell may query before any renderer slot exists to reply.

React 19 Strict Mode mounts effects twice in development. The session record
lives in a module map keyed by leaf id and the first mount's attach is skipped
by a `cancelled` flag, so the double mount does not open a second PTY.

## Frontend

There are two Vite entry points:

- `src/main.tsx`: main workspace.
- `src/settings/main.tsx`: separate settings window.

`src/app/App.tsx` coordinates modules. Feature logic belongs in
`src/modules/<area>/`. Module barrels should expose only consumers' actual
public surface.

The only tab kind is `terminal`.

Tabs are not persisted across launches; every start opens one tab at the launch
directory. New tabs open at home rather than inheriting the active tab's cwd.

Mounted tabs remain alive while inactive so PTYs keep their state. Terminal tabs
contain a pane tree, at most four panes per tab. `PaneNode` splits hold an
n-ary `children` array: splitting along an existing split's direction appends a
sibling instead of nesting, which keeps resize handles aligned.

### Modules

- `terminal`: xterm sessions, split panes, renderer pool, OSC.
- `tabs`: tab source of truth, switcher, pane-aware close behavior.
- `workspace`: Local and WSL environment selection.
- `theme`: built-in/custom themes.
- `settings`, `shortcuts`, `command-palette`: preferences and commands.
- `header`, `statusbar`, `i18n`: application chrome.

There is no file explorer or sidebar. The window is header, terminal surface,
statusbar. Directory navigation is the statusbar cwd breadcrumb, which sends
`cd` to the focused terminal.

`i18n` currently ships one locale, `zh-CN`, with no locale switching.
`usePreferencesStore.init()` is what hydrates preferences from disk and
subscribes to cross-window changes.

## Terminal Rendering

`rendererPool.ts` maintains at most five renderer slots, shared across all tabs,
so cross-tab eviction is normal. Hidden leaves may keep a parked live grid, keep
a released-but-retained buffer, or fall back to a 1 MiB dormant ring that
buffers output for leaves with no bound renderer.

Do not reset a terminal when the dormant ring overflows: the overflow notice
carries no `ESC c` precisely because a reset would erase the snapshot replayed
just before the drain. Avoid reading layout from parked `display:none` slots.
Cursor styling is shared between xterm native rendering and the overlay
implementation.

## Themes

The app theme engine is custom, not `next-themes`. `ThemeProvider` and
`applyTheme` write CSS variables. Six built-ins live under
`src/modules/theme/themes/` (`kite-default`, `claude`, `dracula`, `nord`,
`catppuccin`, `tokyo-night`); `kite-default` has empty variants so it clears
overrides back to the `globals.css` baseline. Custom themes are validated before
use and imported through a plain HTML file input.

Legacy `terax-*` store keys and theme ids are read only as migration fallbacks.
New state is written under `kite-*` names. `.terax-theme` remains a supported
legacy import extension.

## UI

- Tailwind CSS v4 configuration lives in `src/styles/globals.css`.
- shadcn/ui uses `components.json`, radix-luma, mist, and Hugeicons.
- `src/components/ui/` is linted and included in dead-code scans.
- Use `cn()` from `@/lib/utils`.
- Layout resizing uses `react-resizable-panels`.
- Arbitrary URLs are not embedded in the webview.

## Windows And Bundling

- macOS uses overlay title bars and native traffic lights.
- Linux and Windows use transparent, undecorated windows plus React controls.
- The NSIS installer is per-user and embeds the WebView2 bootstrapper.
- Update artifacts are disabled and releases are published manually.
- The CSP allows Tauri IPC and local development connections. It does not
  allow arbitrary WebView network connections or frames.

## Known Gotchas

- `tab.cwd` originates from OSC 7 and uses forward slashes. Rust filesystem
  callers must accept or normalize both separators on Windows.
- `homeDir()` returns backslashes on Windows; normalize at the frontend
  boundary to prevent file-tree resets.
- xterm WebGL uses a fixed glyph atlas. CJK fallback fonts can misalign; users
  can disable WebGL or choose a monospaced CJK font.
- OSC 7 is honored only between commands. Command stdout is untrusted, so a
  remote shell or `cat` of a hostile file cannot move the tracked cwd.
- `src-tauri/tests/` call the command functions directly as plain Rust; they do
  not need a Tauri runtime.

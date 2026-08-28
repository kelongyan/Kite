# TERAX.md

Kite loads `TERAX.md` from the workspace root as coding-assistant memory. This file is
also the living architecture reference. Read it before making changes and keep
it aligned with structural changes.

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
cargo test --locked
```

## Quality Bar

- Correctness: handle edge cases, failures, and concurrent access.
- Performance: avoid unnecessary IPC, renders, memory, and dependencies.
- Security: validate IPC, filesystem, and process boundaries.
- UI/UX: keep every state polished, accessible, and platform appropriate.
- Architecture: put new logic in pure, dependency-light functions and keep
  Tauri commands and React components thin.

Changes to terminal spawning, workspace authorization, or IPC need tests that
lock the relevant invariant.

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

- `pty::*`: open, write, resize, close, foreground-process checks, shell list.
- `fs::tree`: directory listing for the explorer and statusbar.
- `workspace::*`: authorization, current directory, WSL list and home.
- `open_settings_window`: creates or focuses the separate settings webview.

Every filesystem and process entry point must preserve workspace
authorization. Do not add a command only to expose an internal helper.

## PTY And Shell Integration

PTY sessions are managed by `PtyState` and `portable-pty`. Shell bootstrap
scripts live in `src-tauri/src/modules/pty/scripts/` and emit:

- OSC 7 for cwd tracking.
- OSC 133 A/B/C/D for prompt and command boundaries.

Platform rules:

- Unix shells use injected zsh, bash, or fish initialization.
- Windows prefers `pwsh.exe`, then `powershell.exe`, then `cmd.exe`.
- Enter is sent as carriage return (`\r`), not line feed.
- Windows cwd values are normalized before ConPTY spawn.
- `SPAWN_LOCK` serializes `openpty + spawn_command` on Windows. Removing it can
  stall one of multiple concurrent ConPTY sessions.
- Each Windows session uses a Job Object with kill-on-close so child process
  trees do not survive Kite unexpectedly.

React 19 Strict Mode mounts effects twice in development. An initial PTY may
open and close immediately before the real session starts.

## Frontend

There are two Vite entry points:

- `src/main.tsx`: main workspace.
- `src/settings/main.tsx`: separate settings window.

`src/app/App.tsx` coordinates modules. Feature logic belongs in
`src/modules/<area>/`. Module barrels should expose only consumers' actual
public surface.

The only tab kind is `terminal`.

Mounted, booted tabs remain alive while inactive so PTYs keep their
state. Terminal tabs contain a binary pane tree and allow at most four panes.

### Modules

- `terminal`: xterm sessions, split panes, renderer pool, OSC.
- `explorer`: lightweight cwd directory navigator, keyboard navigation,
  reveal/copy-path actions.
- `tabs`: tab source of truth, switcher, pane-aware close behavior.
- `workspace`: Local and WSL environment selection.
- `theme`: built-in/custom themes.
- `settings`, `shortcuts`, `command-palette`: preferences and commands.
- `header`, `sidebar`, `statusbar`, `i18n`: application chrome.

## Terminal Rendering

`rendererPool.ts` maintains at most five renderer slots. Hidden leaves may keep
a parked live grid or release the renderer while retaining their buffer. A
1 MiB dormant ring buffers output for leaves without a bound renderer.

Do not reset a terminal when the dormant ring overflows. Avoid reading layout
from parked `display:none` slots. Cursor styling is shared between xterm native
rendering and the overlay implementation.

## Themes

The app theme engine is custom, not `next-themes`. `ThemeProvider` and
`applyTheme` write CSS variables. Built-ins live under
`src/modules/theme/themes/`; custom themes are validated before use and
imported through a plain HTML file input.

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
- Rust tools may live under `D:\cargo\bin` on the maintainer workstation.

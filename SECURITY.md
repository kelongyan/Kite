# Security

Kite runs shells and reads/writes files — so security bugs matter. If you find one, please tell us before posting it publicly.

## Reporting

Please report security issues privately through GitHub security reporting if enabled, or contact the maintainer privately. Include:

- What the issue is and what it lets an attacker do
- Steps to reproduce (a small PoC is great)
- Version, OS, arch

We'll get back to you within a few days. Once it's fixed, we'll credit you in the release notes — unless you'd rather stay anonymous.

Please **don't** open a public GitHub issue for security reports.

## Supported versions

Until `1.0.0`, only the latest minor gets security fixes.

## What's in scope

- The Rust backend in `src-tauri/` (PTY, filesystem listing, workspace and WSL path handling, IPC, plugins)
- The frontend in `src/` — anywhere untrusted input lands (terminal output, OSC sequences, imported theme files)
- Release artifacts on GitHub

## What's not

- Bugs in upstream deps (Tauri, xterm.js, portable-pty…) — report those upstream. We'll ship the fix once it's released.
- Anything that needs an already-compromised machine or a local attacker with shell access

## What we do to keep things safe

- **No telemetry and no outbound network access.** Kite makes no network requests of its own; the CSP blocks arbitrary WebView connections and frames.
- **No Node in the renderer.** The frontend only reaches the host through the allow-listed Tauri commands.
- **Narrow spawn surface.** A shell override must match an enumerated shell, and every `wsl.exe` argument passes a distro-name validator.
- **OSC trust boundary.** Terminal cwd tracking is honored only between commands, so command output cannot redirect it. OSC 52 clipboard writes are size-capped and limited to the clipboard selection.

Release artifacts are currently **unsigned**. Verify checksums from the release page before installing, and expect a SmartScreen prompt on Windows.

## What we can't promise

- Kite runs whatever command you tell it to run, with your permissions. That's kind of the point of a terminal.

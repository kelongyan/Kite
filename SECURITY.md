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

- The Rust backend in `src-tauri/` (PTY, FS, Git, SFTP, IPC, plugins)
- The frontend in `src/` — anywhere untrusted input lands (terminal output, file content)
- Release artifacts on GitHub

## What's not

- Bugs in upstream deps (Tauri, xterm.js, CodeMirror…) — report those upstream. We'll ship the fix once it's released.
- Anything that needs an already-compromised machine or a local attacker with shell access

## What we do to keep things safe

- **No telemetry.** Network access is limited to user-facing SFTP and Git remote operations.
- **No Node in the renderer.** The frontend only reaches the host through the allow-listed Tauri commands.
- **Signed releases.** Release artifacts should be verified before installation.

## What we can't promise

- Kite runs whatever command you tell it to run, with your permissions. That's kind of the point of a terminal.

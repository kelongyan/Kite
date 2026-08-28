# Roadmap

Kite is a fast, lightweight, terminal-first desktop terminal emulator. It
combines a native PTY backend with multi-tab terminals, split panes, and a
lightweight file explorer. It has no telemetry.

For day-to-day work, use [GitHub Issues](https://github.com/kelongyan/Kite/issues)
and the project board. This document describes product direction rather than a
release commitment.

## Product Principles

1. **Lightweight always.** Every dependency, background task, and renderer must
   justify its memory and bundle cost.
2. **Terminal first.** PTY fidelity, xterm correctness, TUI compatibility, and
   shell integration are core product behavior.
3. **Cross-platform parity.** macOS, Linux, Windows, and WSL should offer the
   same essential workflows.
4. **Security by default.** Workspace authorization, path validation, OSC trust,
   host-key verification, and narrow IPC capabilities remain mandatory.
5. **Focused scope.** Kite complements dedicated IDEs and browsers instead of
   duplicating them.

## Shipped

### Terminal

- [x] Multi-tab terminal with WebGL rendering
- [x] Native PTY support for zsh, bash, fish, PowerShell, and cmd
- [x] Split panes and block-mode terminals
- [x] OSC 7 cwd tracking and OSC 133 prompt boundaries
- [x] Search, web links, true color, and configurable cursor rendering
- [x] Local and WSL workspace environments

### Files And Themes

- [x] Lightweight cwd file explorer with keyboard navigation
- [x] Application theme system with custom theme import

### Platform

- [x] macOS, Linux packages, Windows NSIS, and WSL integration
- [x] Native title-bar behavior per platform
- [x] Windows child-process cleanup through Job Objects
- [x] Manual GitHub releases

## Removed Scope

The code editor, Markdown preview, Git source-control panel, and SFTP client
were removed to keep Kite a simple terminal tool. They are not planned to
return.

## Next Priorities

- [ ] Expand PTY and shell-integration coverage across operating systems
- [ ] Continue bundle and startup-memory profiling
- [ ] Improve keyboard and screen-reader behavior in dense workspace controls
- [ ] Automate release notes, versioning, tagging, and artifact verification

## Wanted Contributions

- Cross-platform PTY, shell, and rendering bug fixes
- Security tests for workspace authorization and the IPC surface
- Focused bundle or memory improvements backed by measurements
- Accessibility fixes for keyboard-heavy workflows
- Terminal and application themes
- Documentation and reproducible platform setup notes

Discuss substantial changes in an issue before implementation.

## Out Of Scope

- Full language-server, debugger, and refactoring-engine integration
- A general web browser or embedded arbitrary-URL preview
- Notebook and document workspaces
- Package-manager and toolchain dashboards
- Telemetry, analytics, cloud accounts, or subscription session bridges
- An IDE-scale extension marketplace

Kite should remain a strong terminal with tightly integrated supporting tools,
not a smaller copy of a full IDE.

## Decision Authority

Direction and scope decisions are made by the project maintainer. Reviewers can
provide input on security, performance, accessibility, and platform behavior.

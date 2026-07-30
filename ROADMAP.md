# Roadmap

Kite is a fast, lightweight, terminal-first desktop environment. It combines
a native PTY backend with multi-tab terminals, split panes, a code editor, a
file explorer, Git workflows, and SFTP. It has no telemetry.

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

### Editor And Files

- [x] CodeMirror 6 editor with language modes and Vim support
- [x] Application and editor theme pairing
- [x] Local image, video, audio, and PDF display
- [x] File tree, fuzzy search, keyboard navigation, and file mutations
- [x] Live filesystem updates
- [x] Markdown rendering

### Git And SFTP

- [x] Git status, staging, discard, commit, fetch, pull, and push
- [x] Commit graph, branch checkout, and per-file diffs
- [x] SFTP profiles with secure credential storage
- [x] Host-key verification and SSH config templates
- [x] Multi-item transfers, cancellation, conflict handling, and sync preview

### Platform

- [x] macOS, Linux packages, Windows NSIS, and WSL integration
- [x] Native title-bar behavior per platform
- [x] Windows child-process cleanup through Job Objects
- [x] Manual GitHub releases

## Next Priorities

- [ ] Expand PTY and shell-integration coverage across operating systems
- [ ] Add live-server SFTP smoke tests and stronger transfer recovery checks
- [ ] Continue bundle and startup-memory profiling
- [ ] Improve keyboard and screen-reader behavior in dense workspace controls
- [ ] Automate release notes, versioning, tagging, and artifact verification
- [ ] Improve failure diagnostics without adding a heavyweight IDE runtime

## Wanted Contributions

- Cross-platform PTY, shell, and rendering bug fixes
- Security tests for workspace authorization, filesystem operations, and SFTP
- Focused bundle or memory improvements backed by measurements
- Accessibility fixes for keyboard-heavy workflows
- Terminal, editor, and application themes
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

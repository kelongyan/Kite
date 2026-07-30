# Contributing to Kite

Kite is a solo-maintained project with a strong product direction. Contributions are welcome, but **alignment matters more than volume**.

This document helps you decide *whether* and *how* to contribute in a way that's likely to get merged, so neither of us wastes time.

## How this project is run

- Kite has one active maintainer.
- Review bandwidth is limited.
- Not every contribution can be accepted, even if it's technically correct. Alignment with project direction matters as much as code quality.
- For scope and direction, see [ROADMAP.md](ROADMAP.md). Read it before opening anything non-trivial.

This is normal for a solo project. A "no" on a PR is not personal.

## Quick start

```bash
pnpm install
pnpm tauri dev
```

Prereqs: Rust (stable), Node 20+, pnpm, plus your platform's [Tauri prerequisites](https://tauri.app/start/prerequisites/).

## Where to discuss

Use GitHub Issues for tracking concrete bugs and features.

## What makes a good contribution

These get merged fast:

- **Bug fixes** with clear reproduction steps.
- **Docs / typos / small UX fixes** - open a PR directly.
- **Pre-discussed features** - alignment in an issue or Discord first.
- **Small, focused changes** - easy to review, low risk.

If your change is small and obvious (typo, narrow bugfix, small docs change), open a PR directly. No issue required.

## Keep changes focused

**Only change what's needed to accomplish your stated goal.**

If you're fixing a bug in `terminal.tsx`, don't also:

- Reformat other files
- Clean up unrelated code
- Fix lint issues in files you didn't need to touch
- Combine multiple unrelated fixes in one PR

Even when these changes are "improvements", they make review harder and slow everything down. If you want to clean things up, open a separate PR after discussion.

**One PR = one logical change.** Multi-concern PRs will be asked to split.

## Discuss first (required for larger changes)

For anything beyond a small fix, **discussion is required before opening a PR**. This includes:


## What makes a good contribution

These get merged fast:

- **Bug fixes** with clear reproduction steps.
- **Docs / typos / small UX fixes** - open a PR directly.
- **Pre-discussed features** - alignment in an issue or Discord first.
- **Small, focused changes** - easy to review, low risk.

If your change is small and obvious (typo, narrow bugfix, small docs change), open a PR directly. No issue required.

## Keep changes focused

**Only change what's needed to accomplish your stated goal.**

If you're fixing a bug in `terminal.tsx`, don't also:

- Reformat other files
- Clean up unrelated code
- Fix lint issues in files you didn't need to touch
- Combine multiple unrelated fixes in one PR

Even when these changes are "improvements", they make review harder and slow everything down. If you want to clean things up, open a separate PR after discussion.

**One PR = one logical change.** Multi-concern PRs will be asked to split.

## Discuss first (required for larger changes)

For anything beyond a small fix, **discussion is required before opening a PR**. This includes:

- New features
- UI/UX changes or changes to default behavior
- Refactors or "cleanup" work
- Performance rewrites
- Architectural changes
- Anything touching many files or systems

Pull requests with significant unsolicited changes will be closed without detailed review. This isn't meant to discourage contribution. It ensures alignment before significant work goes in.

A 10-minute conversation saves a 500-line PR that doesn't fit the roadmap.

## Quality bar

Kite positions itself as **lightweight, fast, production-grade**. Every PR is reviewed against:

- `pnpm exec tsc --noEmit` clean
- `cargo clippy` clean, `cargo fmt` applied
- `pnpm test` and `cargo test` pass
- No perf regressions in known hot paths: terminal renderer, PTY stream, source control, file explorer
- No new heavy dependencies (>50KB gzip in client bundle, >5MB compiled on Rust side) without justification
- Platform parity preserved (macOS / Linux / Windows / WSL still work)
- Security review for changes to file system access, network paths, IPC commands

If you're not sure how to measure perf or what counts as a hot path, ask in Discord or an issue. Better to confirm than get bounced.

## Changes to core subsystems require a test

The most common way a PR breaks Kite is a **local fix with global blast radius**: the diff solves one reported case, reads fine, passes type-check and clippy, and silently breaks the same subsystem in every other case. Review alone does not catch these. A test does.

So if your change touches behavior in any of these load-bearing paths, the PR must add or extend a test that locks the invariant you're relying on:

- **Shell/terminal spawn**: what shell launches, with which cwd, env, and login flags. A "fix" here can stop terminals from starting entirely.
- **Workspace authorization**: which directories spawns and git may operate in. Both the allow and the deny side.
- **Git command layer**: repo-root resolution, pathspec/argument guards, status parsing.
- **Filesystem mutation**: atomic writes, symlink handling, no-data-loss on partial failure.
- **IPC command surface**: anything the webview can invoke.
- **Pure logic with wide reach**: cwd inheritance, tab/split tree transforms, OSC/prompt parsing, the command guard.

The bar for the test is real coverage of the contract, not a placeholder. Test the case that would actually break: the edge, the deny path, the "what happens one level above home". If you can't see how to test it, ask in Discord before opening the PR. That conversation is usually shorter than the revert.

UI rendering, themes, syntax-highlight tables, and anything the type-checker already guarantees do not need tests.

## What Kite is not

To set expectations:

- Kite is not trying to be a full IDE replacement (VS Code, Cursor, Zed).
Don't file them as public issues. See [SECURITY.md](SECURITY.md).

## License

By contributing you agree your work is licensed under [Apache-2.0](LICENSE). No CLA required.

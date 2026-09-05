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

Prereqs: Rust (stable), Node 22+, pnpm 11.x, plus your platform's [Tauri prerequisites](https://tauri.app/start/prerequisites/).

## Where to discuss

Use GitHub Issues for tracking concrete bugs and features.

## What makes a good contribution

These get merged fast:

- **Bug fixes** with clear reproduction steps.
- **Docs / typos / small UX fixes** - open a PR directly.
- **Pre-discussed features** - alignment in an issue first.
- **Small, focused changes** - easy to review, low risk.

If your change is small and obvious (typo, narrow bugfix, small docs change), open a PR directly. No issue required.

## Keep changes focused

**Only change what's needed to accomplish your stated goal.**

If you're fixing a bug in the terminal module, don't also:

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

- `pnpm check-types` clean
- `pnpm lint` clean
- `cargo clippy --all-targets --locked -- -D warnings` clean, `cargo fmt` applied
- `pnpm test` and `cargo nextest run --locked` pass
- `pnpm build && pnpm size` within the size-limit budgets
- No perf regressions in known hot paths: terminal renderer, PTY stream, file explorer
- No new heavy dependencies (>50KB gzip in client bundle, >5MB compiled on Rust side) without justification
- Platform parity preserved (macOS / Linux / Windows / WSL still work)
- Security review for changes to file system access, process spawn, IPC commands

If you're not sure how to measure perf or what counts as a hot path, ask in an issue. Better to confirm than get bounced.

## Changes to core subsystems require a test

The most common way a PR breaks Kite is a **local fix with global blast radius**: the diff solves one reported case, reads fine, passes type-check and clippy, and silently breaks the same subsystem in every other case. Review alone does not catch these. A test does.

So if your change touches behavior in any of these load-bearing paths, the PR must add or extend a test that locks the invariant you're relying on:

- **Shell/terminal spawn**: what shell launches, with which cwd, env, and login flags. A "fix" here can stop terminals from starting entirely.
- **Shell override validation**: `sanitize_shell_override` must keep spawns limited to enumerated shells.
- **WSL path layer**: distro-name validation (both accept and reject), drvfs and UNC mapping, output decoding.
- **IPC command surface**: anything the webview can invoke.
- **Pure logic with wide reach**: cwd inheritance, tab/split tree transforms, OSC/prompt parsing, dormant-ring overflow behavior.

The bar for the test is real coverage of the contract, not a placeholder. Test the case that would actually break: the edge, the reject path, the "what happens one level above home". If you can't see how to test it, ask in an issue before opening the PR. That conversation is usually shorter than the revert.

UI rendering and themes do not need tests.

## What Kite is not

To set expectations:

- Kite is not trying to be a full IDE replacement (VS Code, Cursor, Zed).
- Kite does not ship a code editor, Markdown preview, Git panel, or SFTP client. These were removed deliberately; see [ROADMAP.md](ROADMAP.md).
- Kite has no telemetry, cloud accounts, or extension marketplace.

## Reporting security issues

Don't file them as public issues. See [SECURITY.md](SECURITY.md).

## License

By contributing you agree your work is licensed under [Apache-2.0](LICENSE). No CLA required.

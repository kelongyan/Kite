# High Value Feature Phased Development Plan

> This plan captures the next high ROI feature work for Kite. Update the checkboxes, phase status, commit hash, and verification notes after each phase so future work can resume cleanly.

## Goal

Build practical workflow improvements that strengthen Kite's terminal-first AI workspace without drifting into heavy IDE scope.

The recommended product loop is:

```text
run command -> detect failure -> open the relevant file -> ask AI with focused context -> fix -> rerun from history
```

## Scope Principles

- Prefer features that reuse existing Kite foundations: terminal blocks, command palette, AI context attachment, SFTP transfer queue, history suggestions, and settings.
- Keep all OS, filesystem, shell, Git, secrets, SFTP, and process work behind Rust or Tauri commands.
- Keep frontend additions light and local to the owning module.
- Do not add heavyweight dependencies for parsing, ranking, or UI.
- Never send private terminal output to AI from a private tab.
- Default to user controlled actions. No auto-fix, auto-run, or silent approval policy changes.

## Current Status

- [ ] P0 Problem matcher foundation
- [ ] P1 Terminal failure diagnostics UI
- [ ] P2 AI quick fix integration for failed command blocks
- [ ] P3 Command Center context actions
- [ ] P4 SFTP reliability pack
- [ ] P5 History command intelligence
- [ ] P6 Project approval policy design spike

## Phase Completion Rule

At the end of every phase:

- [ ] Mark the phase checkbox in Current Status.
- [ ] Change the phase status from `Not started` to `Done`.
- [ ] Fill in the phase handoff notes.
- [ ] Add the commit hash if a commit exists.
- [ ] Add verification commands and their result.
- [ ] Note any follow-up work or intentionally deferred edge cases.

Do not start the next phase if the previous phase leaves unclear ownership, failing tests, or an undocumented behavior change.

## Recommended Order

1. P0 and P1 first, because they create the diagnostic backbone.
2. P2 next, because it turns diagnostics into the AI-native workflow.
3. P3 after P2, because the command palette can expose the new diagnostic actions.
4. P4 can run independently after P1 if SFTP reliability becomes urgent.
5. P5 is useful but should not block diagnostics.
6. P6 is a design spike only unless explicitly approved for implementation.

## Phase P0: Problem Matcher Foundation

**Status:** Not started

**Goal:** Add pure, tested parsers that can extract file, line, column, severity, and message from common command output.

**User value:** Kite can understand failed command output without relying on AI or large language models.

### Tasks

- [ ] Add `src/modules/terminal/block/lib/problemMatchers.ts`.
- [ ] Add `src/modules/terminal/block/lib/problemMatchers.test.ts`.
- [ ] Define a small `ProblemMatch` type:

```ts
type ProblemMatch = {
  path: string;
  line: number;
  column?: number;
  severity: "error" | "warning";
  message: string;
  source: string;
};
```

- [ ] Support TypeScript and Vite style output.
- [ ] Support ESLint style output.
- [ ] Support Vitest and generic test failure file locations.
- [ ] Support Rust and Cargo compiler output.
- [ ] Support generic `file:line:column` and `file:line` formats.
- [ ] Limit parsing input to a bounded output tail, for example the final 64 KB.
- [ ] Normalize Windows and Unix paths.
- [ ] Reject suspicious paths that cannot be opened safely.

### Acceptance Criteria

- [ ] Parsers are pure and dependency-light.
- [ ] Tests cover Windows and Unix path examples.
- [ ] Tests cover multiline diagnostics.
- [ ] Tests cover duplicate suppression.
- [ ] Tests cover no-match output.
- [ ] Parser runtime is linear in the size of the bounded input.

### Verification

```sh
pnpm test -- problemMatchers
pnpm check-types
```

### Handoff Notes

- Commit: TBD
- Verification result: TBD
- Deferred work: TBD

## Phase P1: Terminal Failure Diagnostics UI

**Status:** Not started

**Goal:** Show a compact diagnostic strip under a failed command block when Kite detects actionable errors.

**User value:** After a failed command, the user can jump directly to the file and line that matter.

### Tasks

- [ ] Identify the command block completion path in `src/modules/terminal/block`.
- [ ] Store detected problems with the completed block state, not in global app state.
- [ ] Add a compact strip under failed blocks:

```text
3 errors, 1 warning   [Open first] [Copy diagnostics]
```

- [ ] Add a problem popover or compact list if there are multiple matches.
- [ ] Add `Open first` to call the existing editor tab open path.
- [ ] Add `Copy diagnostics` for focused bug reports and AI prompts.
- [ ] Hide the strip when there are no matches.
- [ ] Do not parse or render diagnostics for private terminal tabs.
- [ ] Add i18n messages in English and Chinese.

### Acceptance Criteria

- [ ] A failing TypeScript or Rust command shows the diagnostic strip.
- [ ] Clicking a diagnostic opens the matching file and line.
- [ ] Private terminal tabs do not expose diagnostic actions.
- [ ] Large outputs do not block terminal rendering.
- [ ] No extra Tauri IPC is added during normal terminal streaming.
- [ ] UI remains invisible for successful commands and unmatched failures.

### Verification

```sh
pnpm test
pnpm check-types
pnpm lint
```

### Handoff Notes

- Commit: TBD
- Verification result: TBD
- Deferred work: TBD

## Phase P2: AI Quick Fix Integration For Failed Command Blocks

**Status:** Not started

**Goal:** Add a safe `Ask AI` action that sends focused failure context to Kite AI for explanation and suggested fixes.

**User value:** The user gets help on the exact failure without manually copying terminal output.

### Tasks

- [ ] Add an `Ask AI` button to the failure diagnostic strip.
- [ ] Build a focused context payload:
  - cwd
  - command text
  - exit code
  - bounded output tail
  - detected problem matches
- [ ] Reuse the existing AI composer selection or attachment flow.
- [ ] Make the prompt explicit that AI should explain first and ask before running or editing.
- [ ] Disable `Ask AI` for private terminal tabs.
- [ ] Add a visible private-tab disabled reason.
- [ ] Add tests for context shaping and private-tab suppression.

### Acceptance Criteria

- [ ] Clicking `Ask AI` opens or focuses the AI surface with the failure context attached.
- [ ] The user can review the prompt before sending if the existing composer flow supports it.
- [ ] Private terminal content is never attached.
- [ ] The AI action does not auto-run commands.
- [ ] The AI action does not auto-edit files.

### Verification

```sh
pnpm test
pnpm check-types
pnpm lint
```

### Handoff Notes

- Commit: TBD
- Verification result: TBD
- Deferred work: TBD

## Phase P3: Command Center Context Actions

**Status:** Not started

**Goal:** Turn the command palette into a context-aware command center for common Kite workflows.

**User value:** Users can reach the right action quickly without remembering where it lives.

### Tasks

- [ ] Add context actions to `src/modules/command-palette/commands.ts`.
- [ ] Add `Ask AI about last failure` when a terminal block has a detected failure.
- [ ] Add `Run history command in input` behavior for command history hits.
- [ ] Add settings deep links for models, shortcuts, themes, terminal, agents, and editor.
- [ ] Add SFTP actions when an SFTP tab is active:
  - reconnect
  - clear completed transfers
  - open new SFTP tab
- [ ] Add SSH text selection actions when selected text looks like an SSH command:
  - create SFTP profile from SSH command
  - open SFTP from SSH command
  - insert SSH command into terminal input
- [ ] Add disabled reasons for every context action that cannot run.
- [ ] Keep command ranking MRU aware.
- [ ] Add tests for ranking and disabled states.

### Acceptance Criteria

- [ ] `Ctrl+P` can discover the new actions.
- [ ] Existing command palette modes still work:
  - commands
  - theme picker
  - content search
  - command history
- [ ] No action silently does nothing.
- [ ] SSH command parsing never exposes passwords.
- [ ] i18n messages are complete.

### Verification

```sh
pnpm test -- command-palette
pnpm check-types
pnpm lint
```

### Handoff Notes

- Commit: TBD
- Verification result: TBD
- Deferred work: TBD

## Phase P4: SFTP Reliability Pack

**Status:** Not started

**Goal:** Improve SFTP confidence by adding retry, clearer transfer state, and safer SSH workflow integration.

**User value:** SFTP becomes more reliable for real file transfer work, not just basic browsing.

### Tasks

- [ ] Add retry support for failed transfers.
- [ ] Store enough transfer metadata to retry safely:
  - direction
  - source
  - target
  - conflict policy
  - connection id or profile id
- [ ] Add speed and ETA display in `TransferQueue`.
- [ ] Keep completed, failed, and canceled transfers visible for the tab lifecycle.
- [ ] Show conflict outcomes clearly:
  - skipped
  - overwritten
  - renamed
- [ ] Add `Open SSH Terminal` from an SFTP profile.
- [ ] Generate an SSH command without writing passwords or passphrases to the command line.
- [ ] Add reconnect affordance when remote listing fails because the session is gone.
- [ ] Add tests for transfer retry planning and SSH command generation.

### Acceptance Criteria

- [ ] Failed transfers can be retried.
- [ ] Retry does not bypass conflict policy.
- [ ] Canceled transfers do not continue writing target files.
- [ ] Speed and ETA degrade gracefully when totals are unknown.
- [ ] `Open SSH Terminal` never includes password or passphrase values.
- [ ] Windows, macOS, and Linux shell quoting is covered by tests.

### Verification

```sh
pnpm test -- sftp
pnpm check-types
pnpm lint
cd src-tauri && cargo test --locked sftp
```

### Handoff Notes

- Commit: TBD
- Verification result: TBD
- Deferred work: TBD

## Phase P5: History Command Intelligence

**Status:** Not started

**Goal:** Make command suggestions and command history search more useful by ranking commands with cwd, recency, frequency, and success signals.

**User value:** The command a user probably wants appears faster and with less typing.

### Tasks

- [ ] Extend the history model to track cwd for Kite-recorded commands.
- [ ] Track exit code where available.
- [ ] Prefer commands used in the current cwd.
- [ ] Prefer recent successful commands.
- [ ] Downrank recently failed commands unless the current query strongly matches them.
- [ ] Show cwd and recent time in command history search results.
- [ ] Add a pinned command concept if it can be implemented without a heavy UI.
- [ ] Do not mutate user shell history files.
- [ ] Add tests for ranking and privacy-sensitive inputs.

### Acceptance Criteria

- [ ] Suggestions remain fast for large shell histories.
- [ ] Ranking is deterministic in tests.
- [ ] Commands typed into a running process are never recorded.
- [ ] Password-like commands are filtered or treated conservatively.
- [ ] Existing history search remains usable without cwd data.

### Verification

```sh
pnpm test -- terminal
pnpm check-types
pnpm lint
cd src-tauri && cargo test --locked history
```

### Handoff Notes

- Commit: TBD
- Verification result: TBD
- Deferred work: TBD

## Phase P6: Project Approval Policy Design Spike

**Status:** Not started

**Goal:** Design a safe project-scoped approval policy before implementing any broader auto-approval behavior.

**User value:** Repetitive low-risk AI tool approvals become less noisy while sensitive actions remain protected.

### Tasks

- [ ] Write a short design note before coding.
- [ ] Define policy scope:
  - project only
  - tool only
  - path constraints
  - command constraints
  - expiration or reset behavior
- [ ] Define non-overridable deny rules for secret paths and destructive operations.
- [ ] Define UI copy for the approval card and settings.
- [ ] Define storage location and migration rules.
- [ ] Define audit visibility so users can see what policy allowed.
- [ ] Decide whether implementation should be split into another phased plan.

### Acceptance Criteria

- [ ] The design preserves the secret-path deny list.
- [ ] The design does not allow broad shell auto-approval by default.
- [ ] The design has clear reset and review controls.
- [ ] The design includes tests required before implementation.
- [ ] Maintainer approval is recorded before coding begins.

### Verification

```sh
No code verification required for the design spike.
```

### Handoff Notes

- Commit: TBD
- Review result: TBD
- Deferred work: TBD

## Out Of Scope For This Plan

- Full IDE language server integration.
- Integrated debugger.
- Full remote SSH PTY backend.
- Plugin marketplace.
- Telemetry, accounts, or cloud sync.
- Auto-running AI fixes.
- Broad YOLO approval mode.

## Shared Verification Matrix

Use the smallest relevant set during early implementation, then run the broader set before shipping user-visible workflow changes.

```sh
pnpm lint
pnpm check-types
pnpm test
cd src-tauri && cargo clippy --all-targets --locked -- -D warnings
cd src-tauri && cargo test --locked
```

## Suggested First Implementation Slice

Start with this narrow slice:

- P0 TypeScript, Rust, and generic path matchers.
- P1 strip with `Open first` and `Copy diagnostics`.
- P2 `Ask AI` for non-private failed terminal blocks.

This creates the core workflow with limited surface area and gives the maintainer a concrete build to evaluate before investing in broader command center and SFTP refinements.

# SFTP File Transfer Phased Development Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-grade SFTP file transfer workspace in Kite so users can move files between the local computer and a server with clear progress, safe credentials, and reliable error handling.

**Architecture:** Add an SFTP module to the Rust/Tauri backend and a dedicated SFTP tab surface to the React frontend. Rust owns SSH/SFTP connections, credential access, filesystem streaming, host key verification, and transfer events. React owns the dual-pane UI, connection forms, table browsing, actions, and transfer queue state.

**Tech Stack:** Tauri 2, Rust, React 19, TypeScript, `@tauri-apps/api`, existing Kite settings/secrets/workspace patterns, selected P0 SFTP backend `ssh2` 0.9.6 behind a thin Rust module boundary.

**Companion Document:** See `docs/sftp-ui-design-plan.md` for layout, interaction, visual density, and Termius-inspired UI rules.

---

## Current Status

- [x] P0 Research and dependency decision
- [x] P1 SFTP MVP with dual-pane browsing and single-file transfers
- [x] P2 File management and multi-item transfers
- [x] P3 Terminal and SSH workflow integration
- [x] P4 Advanced transfer and sync features

Update this checklist after each phase is completed. Add the commit hash when a commit exists and always add verification commands to the phase notes before handing off.

**Phase completion rule:** after every phase, update the phase checkbox, the phase status, task checkboxes, and the handoff notes before handing work to the next agent or starting the next phase.

## Product Scope

The feature is a new SFTP workspace tab, not a small sidebar panel. The primary workflow is side-by-side local and remote file management:

- Local pane on the left.
- Remote pane on the right.
- Upload flows left to right.
- Download flows right to left.
- Transfer queue sits at the bottom and remains visible while browsing.

The first release must support safe connection, remote listing, local listing, single-file upload, single-file download, progress reporting, cancel, and failure display. Directory recursion, drag transfer, SSH config parsing, and sync are staged later.

## Non-Goals For MVP

- No remote file editing in P1.
- No two-way sync in P1.
- No implicit reuse of an interactive terminal SSH session in P1.
- No automatic overwrite without user choice.
- No AI tool access to SFTP in P1.

## Key Architecture Decisions

### 1. Dedicated SFTP Tab

Add a new tab kind `sftp` so SFTP gets the full workspace area. This matches the Termius reference and avoids squeezing file transfer into the left sidebar.

Expected frontend changes:

- Modify `src/modules/tabs/lib/useTabs.ts` to add an SFTP tab factory.
- Modify `src/modules/tabs/TabBar.tsx` to add a new menu item.
- Modify `src/app/components/WorkspaceSurface.tsx` to mount `SftpTransferStack`.
- Add `src/modules/sftp/` for all SFTP UI and state.

### 2. Backend Owns All SFTP Operations

The webview must never hold raw passwords, private key passphrases, or SSH session objects. Frontend sends profile ids and transfer intents; Rust resolves credentials through `secrets`.

Expected backend changes:

- Create `src-tauri/src/modules/sftp/mod.rs`.
- Create `src-tauri/src/modules/sftp/session.rs`.
- Create `src-tauri/src/modules/sftp/transfer.rs`.
- Create `src-tauri/src/modules/sftp/profile.rs`.
- Register module commands in `src-tauri/src/lib.rs`.
- Store non-secret profile metadata through `tauri-plugin-store`.
- Store passwords and passphrases through existing `secrets` patterns.

### 3. Streaming Transfers

All transfers must be chunked. Never load a whole file into memory.

Upload path:

```text
local source file -> chunked read -> remote temp file -> remote rename to final target
```

Download path:

```text
remote source file -> chunked read -> local temp file -> fsync -> local atomic rename
```

Default transfer concurrency is 2. This keeps memory use predictable and fits Kite's lightweight product goal.

### 4. Host Key Verification

First connection to a host must surface the host key fingerprint. The user must explicitly trust it before a session is usable. A changed fingerprint blocks connection until the user reviews and accepts the new key.

Profile metadata stores:

```json
{
  "id": "prod-1",
  "name": "Production",
  "host": "example.com",
  "port": 22,
  "username": "deploy",
  "authMethod": "key",
  "defaultRemotePath": "/home/deploy",
  "trustedHostKey": "SHA256:..."
}
```

Secrets store:

```text
kite-sftp:<profile-id>:password
kite-sftp:<profile-id>:passphrase
```

## Phase P0: Research And Dependency Decision

**Goal:** Choose the SFTP backend library and lock the minimum safe connection model before adding UI.

**Priority:** Critical
**Complexity:** Medium
**Status:** [x] Completed on 2026-07-08

**Files:**

- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/Cargo.lock`
- Create: `src-tauri/src/modules/sftp/mod.rs`
- Create: `src-tauri/src/modules/sftp/session.rs`
- Create: `src-tauri/src/modules/sftp/session_test.rs` if tests are split

**Tasks:**

- [x] Compare `ssh2`, `russh + russh-sftp`, and `openssh-sftp-client` for Windows/macOS/Linux support.
- [x] Confirm supported auth methods for P1: password and private key file with optional passphrase.
- [x] Confirm host key fingerprint extraction and verification path.
- [x] Confirm library can stream read/write without full buffering.
- [x] Add the selected dependency with the narrowest feature set.
- [x] Add a backend unit test for profile validation: host required, port range 1 to 65535, username required, remote path absolute.
- [x] Add a backend unit test for host key trust comparison.
- [x] Run `cd src-tauri; cargo test --locked`.
- [ ] Commit with `feat: choose sftp backend` when git handoff is requested.

**Recommended Decision:** Start with `ssh2` if it satisfies host key and streaming requirements without adding a large runtime. Keep the SFTP API behind `session.rs` so the library can be replaced later.

**Acceptance Criteria:**

- The chosen backend compiles on Windows.
- A test covers profile validation.
- A test covers trusted host key matching and mismatch.
- No frontend UI is added in P0.

### Phase P0 Handoff

- Status: completed
- Commit: not created in this turn because no commit was explicitly requested
- Dependency decision: selected `ssh2` 0.9.6 over `russh-sftp` 2.3.0 and `openssh-sftp-client` 0.15.7 for P1 because it is mature, cross-platform, exposes password and private-key auth, supports host key checks, and provides standard streaming IO. It remains isolated behind `src-tauri/src/modules/sftp/session.rs`.
- Main files changed:
  - `src-tauri/Cargo.toml`
  - `src-tauri/Cargo.lock`
  - `src-tauri/src/modules/mod.rs`
  - `src-tauri/src/modules/sftp/mod.rs`
  - `src-tauri/src/modules/sftp/profile.rs`
  - `src-tauri/src/modules/sftp/session.rs`
  - `docs/sftp-phased-development-plan.md`
- Verification:
  - `cd src-tauri; cargo test sftp`
  - `cd src-tauri; cargo test --locked`
- Known limitations:
  - No SFTP network connection, Tauri command, transfer worker, or frontend UI exists yet.
  - `ssh2` is using default features in P0. If Windows packaging later fails due native OpenSSL or vcpkg availability, revisit platform-specific features before P1 ships.
  - Frontend checks were not run for P0 because no frontend files changed.
- Next phase entry point: implement P1 backend commands and the dedicated dual-pane SFTP tab, starting with profile metadata storage and `sftp_connect`.

## Phase P1: SFTP MVP

**Goal:** Deliver a usable SFTP tab with connection, local listing, remote listing, single-file upload, single-file download, progress, cancel, and error states.

**Priority:** Critical
**Complexity:** High
**Status:** [x] Completed on 2026-07-08

**Backend Files:**

- Create: `src-tauri/src/modules/sftp/profile.rs`
- Create: `src-tauri/src/modules/sftp/commands.rs`
- Create: `src-tauri/src/modules/sftp/transfer.rs`
- Modify: `src-tauri/src/modules/mod.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/modules/secrets.rs` only if a small helper is required

**Frontend Files:**

- Create: `src/modules/sftp/index.ts`
- Create: `src/modules/sftp/SftpTransferStack.tsx`
- Create: `src/modules/sftp/components/SftpFilePane.tsx`
- Create: `src/modules/sftp/components/SftpConnectionDialog.tsx`
- Create: `src/modules/sftp/components/TransferQueue.tsx`
- Create: `src/modules/sftp/lib/types.ts`
- Create: `src/modules/sftp/lib/path.ts`
- Create: `src/modules/sftp/store/sftpStore.ts`
- Modify: `src/app/components/WorkspaceSurface.tsx`
- Modify: `src/modules/tabs/lib/useTabs.ts`
- Modify: `src/modules/tabs/TabBar.tsx`
- Modify: `src/modules/i18n/messages/en.ts`
- Modify: `src/modules/i18n/messages/zh-CN.ts`

**Backend Commands For P1:**

```text
sftp_profile_list
sftp_profile_save
sftp_profile_delete
sftp_connect
sftp_disconnect
sftp_read_dir
sftp_upload_file
sftp_download_file
sftp_cancel_transfer
```

**Transfer Event:**

```json
{
  "id": "transfer-1",
  "connectionId": "conn-1",
  "direction": "upload",
  "source": "C:/Users/Administrator/Desktop/a.zip",
  "target": "/home/deploy/a.zip",
  "bytesDone": 1048576,
  "bytesTotal": 8388608,
  "status": "running",
  "error": null
}
```

**Tasks:**

- [x] Write Rust tests for profile validation and secret key naming.
- [x] Implement profile metadata storage without secret values.
- [x] Write Rust tests for path validation: remote paths must be absolute, local paths must resolve through workspace authorization for downloads.
- [x] Implement `sftp_connect` with host key fingerprint result when trust is missing.
- [x] Implement `sftp_read_dir` returning `name`, `kind`, `size`, `mtime`, `permissions`.
- [x] Implement upload streaming to a remote temp file and final rename.
- [x] Implement download streaming to a local temp file and atomic rename.
- [x] Emit progress events during upload and download.
- [x] Implement transfer cancellation using a backend transfer handle.
- [x] Write TypeScript tests for remote path breadcrumb helpers.
- [x] Build `SftpTransferStack` with left local pane and right remote pane.
- [x] Build `SftpConnectionDialog` with host, port, username, auth method, password/key path, default path, and host key trust confirmation.
- [x] Build `TransferQueue` with compact and expanded states.
- [x] Add SFTP tab entry to the new tab menu.
- [x] Add i18n messages for SFTP labels and errors.
- [x] Run `pnpm check-types`.
- [x] Run `pnpm test`.
- [x] Run `pnpm lint`.
- [x] Run `cd src-tauri; cargo test --locked`.
- [ ] Commit with `feat: add sftp transfer workspace`.

**Acceptance Criteria:**

- User can open an SFTP tab.
- User can connect to a server with a saved profile.
- User can browse local and remote directories.
- User can upload one local file to the current remote directory.
- User can download one remote file to the current local directory.
- Progress appears in the queue and reaches done.
- Cancel stops a running transfer and marks it canceled.
- Secrets are not written to profile metadata, logs, or frontend persistent stores.

### Phase P1 Handoff

- Status: completed
- Commit: not created in this turn because no commit was explicitly requested
- Main files changed:
  - `src-tauri/Cargo.toml`
  - `src-tauri/Cargo.lock`
  - `src-tauri/src/lib.rs`
  - `src-tauri/src/modules/mod.rs`
  - `src-tauri/src/modules/secrets.rs`
  - `src-tauri/src/modules/sftp/`
  - `src/app/App.tsx`
  - `src/app/components/WorkspaceSurface.tsx`
  - `src/modules/header/Header.tsx`
  - `src/modules/i18n/messages/en.ts`
  - `src/modules/i18n/messages/zh-CN.ts`
  - `src/modules/tabs/`
  - `src/modules/sftp/`
- Verification:
  - `pnpm check-types` passed.
  - `pnpm test src/modules/sftp/lib/path.test.ts` passed: 1 file, 3 tests.
  - `pnpm test` passed: 40 files, 298 tests.
  - `pnpm lint` exited 0. Existing unrelated warnings remain in AI and Settings files.
  - `cd src-tauri; cargo clippy --locked --all-targets` passed with no warnings.
  - `cd src-tauri; cargo test sftp --locked` passed: 20 SFTP tests.
  - `cd src-tauri; cargo test --locked` passed: 191 unit tests plus integration suites.
  - `git diff --check` passed.
- Known limitations:
  - No live SFTP smoke test was run because no test server or credentials were available in this workspace.
  - P1 only supports single-file upload and download. Multi-select, folders, remote create, rename, and delete are P2 work.
  - Multiple SFTP tabs currently share one active connection and transfer queue through the global SFTP store.
  - Existing transfer targets are blocked instead of overwritten. Conflict handling and overwrite confirmation UI are P2 work.
  - Command palette, terminal SSH parsing, and SSH config templates are not implemented until P3.
- Next phase entry point: start P2 by adding backend commands for remote create directory, rename, delete, and multi-item transfer queue jobs with conflict handling.

## Phase P2: File Management And Multi-Item Transfers

**Goal:** Make SFTP useful for everyday file management and batch transfer workflows.

**Priority:** High
**Complexity:** High
**Status:** [x] Completed on 2026-07-08

**Files:**

- Modify: `src-tauri/src/modules/sftp/commands.rs`
- Modify: `src-tauri/src/modules/sftp/transfer.rs`
- Modify: `src/modules/sftp/components/SftpFilePane.tsx`
- Modify: `src/modules/sftp/components/TransferQueue.tsx`
- Create: `src/modules/sftp/components/ConflictDialog.tsx`
- Create: `src/modules/sftp/lib/selection.ts`

**New Commands:**

```text
sftp_create_dir
sftp_rename
sftp_delete
sftp_upload_entries
sftp_download_entries
```

**Tasks:**

- [x] Add backend tests for remote create directory.
- [x] Add backend tests for remote rename refusing overwrite.
- [x] Add backend tests for remote delete not following symlinked directories recursively.
- [x] Implement remote create, rename, and delete.
- [x] Add multi-select state in both panes.
- [x] Add Actions menu items for selected files.
- [x] Implement multi-file upload and download as queued transfer jobs.
- [x] Add directory recursion with symlink policy set to "do not follow".
- [x] Add conflict dialog with choices: skip, overwrite, rename.
- [x] Add tests for conflict decision reducer.
- [x] Run frontend and backend verification.
- [ ] Commit with `feat: expand sftp file management`.

**Acceptance Criteria:**

- User can select multiple files.
- User can transfer multiple files and folders.
- User can create, rename, and delete remote folders/files.
- Existing targets do not get overwritten without a visible user decision.
- Failed items do not stop unrelated queued items.

### Phase P2 Handoff

- Status: completed
- Commit: not created in this turn because no commit was explicitly requested
- Main files changed:
  - `src-tauri/src/lib.rs`
  - `src-tauri/src/modules/sftp/commands.rs`
  - `src-tauri/src/modules/sftp/path.rs`
  - `src/modules/sftp/SftpTransferStack.tsx`
  - `src/modules/sftp/components/SftpFilePane.tsx`
  - `src/modules/sftp/components/ConflictDialog.tsx`
  - `src/modules/sftp/lib/api.ts`
  - `src/modules/sftp/lib/conflict.ts`
  - `src/modules/sftp/lib/conflict.test.ts`
  - `src/modules/sftp/lib/selection.ts`
  - `src/modules/sftp/lib/selection.test.ts`
  - `src/modules/sftp/lib/types.ts`
  - `src/modules/i18n/messages/en.ts`
  - `src/modules/i18n/messages/zh-CN.ts`
  - `docs/sftp-phased-development-plan.md`
- Verification:
  - `pnpm test src/modules/sftp/lib/selection.test.ts src/modules/sftp/lib/conflict.test.ts` passed: 2 files, 5 tests.
  - `pnpm check-types` passed.
  - `pnpm test` passed: 42 files, 303 tests.
  - `pnpm lint` exited 0. Existing unrelated AI and Settings warnings remain.
  - `cd src-tauri; $env:CARGO_BUILD_JOBS='1'; $env:RUSTFLAGS='-C debuginfo=0'; cargo test --lib sftp --locked` passed: 24 SFTP tests.
  - `cd src-tauri; $env:CARGO_BUILD_JOBS='1'; $env:RUSTFLAGS='-C debuginfo=0'; cargo clippy --locked --all-targets` passed with no warnings.
  - `cd src-tauri; $env:CARGO_BUILD_JOBS='1'; $env:RUSTFLAGS='-C debuginfo=0'; cargo test --locked` passed: 195 unit tests plus integration suites.
  - `git diff --check` passed with only Windows LF/CRLF warnings.
- Known limitations:
  - No live SFTP smoke test was run because no server credentials were available in this workspace.
  - Conflict detection is preflighted for selected top-level names in the current panes. Nested folder conflicts are still handled by backend policy during recursive transfer.
  - Remote create, rename, and delete are implemented through the SFTP tab actions menu. Local file management remains outside P2 scope.
  - Multiple SFTP tabs still share one active connection and transfer queue through the global SFTP store.
- Next phase entry point: start P3 by adding command palette and terminal workflow integration, then parse SSH commands and simple SSH config host templates.

## Phase P3: Terminal And SSH Workflow Integration

**Goal:** Connect SFTP to the workflows users already perform in terminals.

**Priority:** Medium
**Complexity:** Medium
**Status:** [x] Completed on 2026-07-08

**Files:**

- Modify: `src/modules/terminal/lib/useTerminalSession.ts`
- Modify: `src/modules/command-palette/commands.ts`
- Modify: `src/modules/sftp/store/sftpStore.ts`
- Modify: `src/modules/sftp/SftpTransferStack.tsx`
- Create: `src-tauri/src/modules/sftp/ssh_config.rs`

**Tasks:**

- [x] Add command palette action "Open SFTP".
- [x] Add terminal context menu action "Open SFTP from current directory".
- [x] Parse simple `ssh user@host` and `ssh -p 2222 user@host` strings to prefill a profile.
- [x] Read common `~/.ssh/config` host entries into selectable profile templates.
- [x] Support `IdentityFile` from SSH config when it resolves to a safe local path.
- [x] Add tests for SSH command parsing.
- [x] Add tests for SSH config parsing with Host, HostName, User, Port, IdentityFile.
- [x] Run frontend and backend verification.
- [ ] Commit with `feat: integrate sftp with ssh workflows`.

**Acceptance Criteria:**

- User can open SFTP quickly from the command palette.
- User can prefill connection details from an SSH command.
- Basic SSH config hosts appear as connection templates.

### Phase P3 Handoff

- Status: completed
- Commit: not created in this turn because no commit was explicitly requested
- Main files changed:
  - `src-tauri/src/lib.rs`
  - `src-tauri/src/modules/sftp/mod.rs`
  - `src-tauri/src/modules/sftp/ssh_config.rs`
  - `src/app/App.tsx`
  - `src/app/components/WorkspaceSurface.tsx`
  - `src/modules/command-palette/commands.ts`
  - `src/modules/command-palette/commands.test.ts`
  - `src/modules/i18n/messages/en.ts`
  - `src/modules/i18n/messages/zh-CN.ts`
  - `src/modules/sftp/components/SftpConnectionDialog.tsx`
  - `src/modules/sftp/lib/api.ts`
  - `src/modules/sftp/lib/sshCommand.ts`
  - `src/modules/sftp/lib/sshCommand.test.ts`
  - `src/modules/sftp/lib/types.ts`
  - `src/modules/terminal/PaneTreeView.tsx`
  - `src/modules/terminal/TerminalStack.tsx`
  - `docs/sftp-phased-development-plan.md`
- Verification:
  - `pnpm test src/modules/command-palette/commands.test.ts src/modules/sftp/lib/sshCommand.test.ts` passed: 2 files, 4 tests.
  - `pnpm check-types` passed.
  - `pnpm test` passed: 43 files, 306 tests.
  - `pnpm lint` exited 0. Existing unrelated AI and Settings warnings remain.
  - `cd src-tauri; $env:CARGO_BUILD_JOBS='1'; $env:RUSTFLAGS='-C debuginfo=0'; cargo test --lib ssh_config --locked` passed: 2 SSH config tests.
  - `cd src-tauri; $env:CARGO_BUILD_JOBS='1'; $env:RUSTFLAGS='-C debuginfo=0'; cargo test --lib sftp --locked` passed: 26 SFTP tests.
  - `cd src-tauri; rustfmt --check src\modules\sftp\ssh_config.rs` passed for the new Rust module. Full `cargo fmt --check` was not used as a phase gate because the existing Rust tree has unrelated formatting drift.
  - `cd src-tauri; $env:CARGO_BUILD_JOBS='1'; $env:RUSTFLAGS='-C debuginfo=0'; cargo clippy --locked --all-targets` passed with no warnings.
  - `cd src-tauri; $env:CARGO_BUILD_JOBS='1'; $env:RUSTFLAGS='-C debuginfo=0'; cargo test --locked` passed: 197 unit tests plus integration suites.
- Known limitations:
  - No live SFTP smoke test was run because no server credentials were available in this workspace.
  - SSH command parsing intentionally covers simple profile-prefill commands first. Complex OpenSSH options such as `ProxyJump`, `ProxyCommand`, `Include`, and remote commands are not interpreted in P3.
  - SSH config parsing reads common `Host`, `HostName`, `User`, `Port`, and safe `IdentityFile` fields. Wildcard hosts, `Match`, `Include`, and token-expanded identity paths such as `%h` are skipped.
  - The terminal context action opens an SFTP tab using the terminal's current local directory. It does not infer a remote directory from an already-running interactive SSH process.
- Next phase entry point: start P4 with advanced transfer capabilities, especially transfer resume, remote search, and local-vs-remote comparison previews.

## Phase P4: Advanced Transfer And Sync Features

**Goal:** Add power-user features after the base transfer model is stable.

**Priority:** Medium
**Complexity:** High
**Status:** [x] Completed on 2026-07-08

**Files:**

- Create: `src/modules/sftp/components/SyncPreview.tsx`
- Create: `src/modules/sftp/lib/diffEntries.ts`
- Modify: `src-tauri/src/modules/sftp/transfer.rs`
- Modify: `src/modules/ai/tools/tools.ts` only when AI SFTP access is approved

**Tasks:**

- [x] Add resumable download support when remote size and local partial size match.
- [x] Add resumable upload support when server supports append or seek.
- [x] Add remote search by filename.
- [x] Add local vs remote comparison preview.
- [x] Add one-way sync: local to remote.
- [x] Add one-way sync: remote to local.
- [x] Add AI tool access only behind explicit approval cards.
- [x] Add tests for sync diff generation.
- [x] Add tests for deny-list behavior on AI SFTP requests.
- [x] Run full frontend and backend verification.
- [ ] Commit with `feat: add advanced sftp workflows`.

**Acceptance Criteria:**

- User can preview sync changes before applying them.
- Sync never deletes or overwrites without an explicit visible confirmation.
- AI cannot transfer files without user approval.

### Phase P4 Handoff

- Status: completed
- Commit: not created in this turn because no commit was explicitly requested
- Main files changed:
  - `src-tauri/src/lib.rs`
  - `src-tauri/src/modules/sftp/commands.rs`
  - `src-tauri/src/modules/sftp/path.rs`
  - `src/modules/sftp/SftpTransferStack.tsx`
  - `src/modules/sftp/components/SyncPreview.tsx`
  - `src/modules/sftp/lib/api.ts`
  - `src/modules/sftp/lib/diffEntries.ts`
  - `src/modules/sftp/lib/diffEntries.test.ts`
  - `src/modules/ai/tools/tools.test.ts`
  - `src/modules/i18n/messages/en.ts`
  - `src/modules/i18n/messages/zh-CN.ts`
  - `docs/sftp-phased-development-plan.md`
- Verification:
  - `pnpm test src/modules/sftp/lib/diffEntries.test.ts src/modules/ai/tools/tools.test.ts` passed: 2 files, 5 tests.
  - `pnpm check-types` passed.
  - `pnpm test` passed: 45 files, 311 tests.
  - `pnpm lint` exited 0. Existing unrelated warnings remain in AI and Settings files.
  - `cd src-tauri; rustfmt --edition 2024 --config skip_children=true --check src\modules\sftp\commands.rs src\lib.rs` passed.
  - `cd src-tauri; $env:CARGO_BUILD_JOBS='1'; $env:RUSTFLAGS='-C debuginfo=0'; cargo test --lib sftp --locked` passed: 30 SFTP tests.
  - `cd src-tauri; $env:CARGO_BUILD_JOBS='1'; $env:RUSTFLAGS='-C debuginfo=0'; cargo clippy --locked --all-targets` passed with no warnings.
  - `cd src-tauri; $env:CARGO_BUILD_JOBS='1'; $env:RUSTFLAGS='-C debuginfo=0'; cargo test --locked` passed: 201 unit tests plus integration suites.
  - `git diff --check` passed with only Windows LF/CRLF warnings.
- Known limitations:
  - No live SFTP smoke test was run because no server credentials were available in this workspace.
  - Resume support uses stable `.kitepart` partial files and resumes when the partial size is smaller than the source total. It does not yet verify partial content with checksums.
  - Upload resume depends on the server accepting seek/write on the existing partial file. Servers that reject that mode may require restarting the transfer.
  - Sync preview compares the currently loaded pane entries and never deletes destination-only files. It does not recursively diff already-existing matching directories yet.
  - AI SFTP tools remain default-denied. No SFTP tool is exposed to the agent until a separate explicit approval-card design is added.
  - Browser UI verification through plain Vite was attempted, but the app requires the Tauri runtime and crashes in a normal browser due missing Tauri internals. Type, unit, lint, clippy, and Rust tests are the completed verification gates for this phase.
- Next phase entry point: decide whether to add P5 live-server smoke tests, recursive sync diff, or explicit AI SFTP approval-card tools.

## Risk Register

| Risk | Impact | Mitigation |
| --- | --- | --- |
| SSH library pulls heavy native dependencies | Larger build and harder packaging | Hide library behind `session.rs`; test Windows build in P0 |
| Credentials leak into logs or stores | Critical security issue | Keep secrets in Rust keychain only; redact errors before events |
| Host key mismatch ignored | Man-in-the-middle risk | Block mismatch by default |
| Large file transfer spikes memory | App freeze or crash | Chunked IO and low concurrency |
| Remote delete follows symlink unexpectedly | Data loss | Use lstat semantics and never recurse through symlink in delete |
| UI becomes too wide for laptops | Poor usability | Allow pane collapse and responsive column hiding |

## Verification Checklist Before Each Phase Completion

- [ ] `git status --short` reviewed.
- [ ] `pnpm check-types` passes.
- [ ] `pnpm test` passes.
- [ ] `pnpm lint` exits 0.
- [ ] `cd src-tauri; cargo test --locked` passes for backend phases.
- [ ] Manual SFTP smoke test recorded with server type and auth method.
- [ ] No unrelated `docs/` or generated artifacts staged unless the phase explicitly changes docs.

## Handoff Notes Template

Use this after each phase:

```markdown
### Phase PX Handoff

- Status: completed
- Commit: <hash>
- Main files changed:
- Verification:
- Known limitations:
- Next phase entry point:
```

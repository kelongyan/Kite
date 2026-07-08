# SFTP UI Design Plan

**Goal:** Define the SFTP user experience for Kite using the Termius dual-pane SFTP screen as a reference while preserving Kite's own theme, density, and architecture.

**Companion Document:** See `docs/sftp-phased-development-plan.md` for implementation phases, backend responsibilities, and verification.

---

## Design Direction

The primary UI is a dedicated SFTP workspace tab with two equal file panes:

- Local pane on the left.
- Remote pane on the right.
- Transfer queue at the bottom.
- Connections and file actions live inside the SFTP tab, not in the global sidebar.

This design supports the core mental model: files move between two visible locations. Upload is left to right. Download is right to left.

## Why This Changes The Earlier Direction

The earlier Remote sidebar idea is useful for quick browsing, but it is not the best primary transfer workflow. The Termius reference shows why:

- Users need to see local and remote locations at the same time.
- File transfer depends on selected source and destination.
- Table layout with metadata is more useful than a compact tree.
- Each side needs independent filter, path navigation, and actions.

Kite should therefore ship the dual-pane SFTP tab first. A sidebar shortcut can come later as a quick launcher.

## Layout

```text
SFTP tab
┌────────────────────────────────────────────────────────────────────┐
│ Connection bar                                                     │
│ [Profile: Production] [Connected] [Reconnect] [New Connection]      │
├──────────────────────────────┬─────────────────────────────────────┤
│ Local                        │ Remote: deploy@example.com           │
│ [back] [forward] [up] path   │ [back] [forward] [up] path           │
│ [Filter] [Actions]           │ [Filter] [Actions]                   │
│ Name | Date | Size | Kind    │ Name | Date | Size | Kind            │
│ rows                         │ rows                                 │
├──────────────────────────────┴─────────────────────────────────────┤
│ Transfer Queue: 1 running, 2 done, 0 failed             [expand]    │
└────────────────────────────────────────────────────────────────────┘
```

The connection bar may collapse into the remote pane header after P1. The first implementation can keep it visible for clarity.

## Pane Anatomy

Each pane has four parts.

### 1. Pane Header

Local header:

```text
[local icon] Local
```

Remote header:

```text
[server icon] Production
deploy@example.com:22
```

Connection state:

- Connected: muted green dot or icon.
- Connecting: spinner.
- Disconnected: muted warning tone.
- Error: destructive tone with tooltip.

### 2. Toolbar

Each pane owns its own toolbar:

```text
[Back] [Forward] [Up]  breadcrumb path        [Filter] [Actions]
```

Rules:

- Use icon buttons for Back, Forward, Up, Refresh, New Folder.
- Use text only for `Filter` and `Actions`, matching the Termius reference.
- Actions menu applies only to that pane.
- Disabled actions must stay visible when they teach available behavior.

### 3. Breadcrumb Path

Local examples:

```text
C: > Users > Administrator > Desktop
```

Remote examples:

```text
home > deploy > releases
```

Rules:

- Breadcrumb segments are clickable.
- Root segment is explicit.
- Long paths truncate in the middle.
- Manual path entry is available by clicking the blank path area or using `Ctrl+L`.

### 4. File Table

Columns:

```text
Name | Date Modified | Size | Kind
```

Remote row detail under name:

```text
app
drwxr-xr-x
```

Local rows do not need permissions. Remote rows should show permissions because server workflows often depend on them.

Column behavior:

- Name flexes.
- Date has fixed width.
- Size has fixed width and right alignment.
- Kind has fixed width.
- On narrow widths, hide Kind first, then Date.
- Sorting is per-pane and shown in the column header.

## Visual Style

The design should borrow Termius' density and dual-pane structure, not its exact palette.

Use Kite tokens:

- Background: `bg-background`
- Pane header: `bg-card` or `bg-muted/30`
- Borders: `border-border/60`
- Text: `text-foreground`, `text-muted-foreground`
- Active row: `bg-accent text-accent-foreground`
- Hover row: `hover:bg-muted/60`

Avoid:

- Marketing-style cards.
- Large empty headers.
- Decorative gradients.
- Extra explanation text inside the app.
- Purple or blue-heavy gradients.

Recommended dimensions:

- SFTP tab padding: 0 or 8px depending on surrounding workspace chrome.
- Pane toolbar height: 40px.
- Table header height: 32px.
- Table row height: 30px.
- Transfer queue compact height: 36px.
- Expanded transfer queue max height: 220px.

## Interaction Model

### Opening SFTP

Entry points:

- New tab menu: `SFTP`.
- Command palette: `Open SFTP`.
- Later: terminal context action from SSH command or current cwd.

First open state:

```text
Left pane: current workspace root or active terminal cwd.
Right pane: connection picker empty state.
Bottom queue: collapsed.
```

Connection empty state should be compact:

```text
No SFTP connection
[Connect]
```

### Selection

Rules:

- Single click selects a row.
- Double click directory enters it.
- Double click file selects it and prepares transfer action.
- `Shift` selects range.
- `Ctrl` toggles individual rows.
- `Ctrl+A` selects visible rows in the focused pane.
- Keyboard focus is per-pane.

### Upload And Download

Primary actions:

- Local selection + `Upload` sends selected items to current remote directory.
- Remote selection + `Download` sends selected items to current local directory.
- Drag local row to remote pane uploads.
- Drag remote row to local pane downloads.

P1 may implement buttons first and drag in P2. The UI should reserve drop target states from the beginning.

### Actions Menu

Local actions:

- Upload selected
- New folder
- Reveal in file manager
- Copy path
- Refresh

Remote actions:

- Download selected
- New folder
- Rename
- Delete
- Copy path
- Refresh
- Disconnect

Destructive actions:

- Use confirmation dialog for remote delete.
- For large directory transfers, show a summary before starting.

### Conflict Handling

When target exists, show `ConflictDialog`:

```text
Target already exists
app.zip exists in /home/deploy/releases

[Skip] [Replace] [Keep both]
Apply to all conflicts
```

Default action is `Skip`. `Replace` is never the default.

## Transfer Queue

Compact state:

```text
Transfer Queue   1 running   2 done   1 failed        [expand]
```

Expanded state:

```text
Direction | File | From | To | Progress | Speed | Status | Action
```

Status values:

- queued
- running
- done
- failed
- canceled

Actions:

- Cancel running or queued item.
- Retry failed item.
- Clear completed items.

Progress row:

```text
↑ dist.zip     42%  4.2 MB / 10 MB  1.1 MB/s
↓ logs.tar.gz  done
```

Use arrows and icons only when they are clear. Include text labels in tooltips.

## Responsive Behavior

Wide desktop:

- Two panes split 50/50.
- User can resize panes.

Medium width:

- Two panes remain visible.
- Hide Kind column first.

Narrow width:

- Use segmented control: `Local | Remote`.
- Transfer queue remains visible.
- Upload/download buttons must still show destination summary.

Minimum useful width for dual-pane mode should be tested around 1100px.

## Keyboard Shortcuts

Suggested shortcuts:

- `Ctrl+L`: focus path entry in active pane.
- `Ctrl+F`: focus filter in active pane.
- `F5`: refresh active pane.
- `Backspace`: go up one directory.
- `Enter`: enter directory.
- `Delete`: delete selected remote item with confirmation.
- `Ctrl+U`: upload selected local items.
- `Ctrl+D`: download selected remote items when focus is remote pane.

Shortcut labels should appear in menu items, not in permanent instructional text.

## Empty And Error States

Local pane empty:

```text
This folder is empty
```

Remote disconnected:

```text
Not connected
[Connect]
```

Remote connection error:

```text
Could not connect
Authentication failed
[Edit Connection] [Retry]
```

Host key mismatch:

```text
Host key changed
Kite blocked the connection because the saved fingerprint no longer matches.
[Review Fingerprint]
```

Do not bury host key warnings inside toasts.

## Accessibility

- File rows use proper `role="row"` and selected state.
- Table headers expose sorting state.
- Icon buttons have `aria-label`.
- Transfer progress exposes text values, not only visual bars.
- Keyboard-only users can connect, browse, transfer, cancel, and retry.
- Focus ring must be visible on rows and toolbar controls.

## Data Display Rules

File size:

- Bytes below 1 KB.
- KB, MB, GB with one decimal when useful.
- Folders show `--`.

Date:

- Use locale-aware date and time.
- If unavailable, show `--`.

Kind:

- `folder`, `file`, `link`, or extension-like type when known.

Permissions:

- Remote only.
- Display under the file name in muted monospace text.

## Component Breakdown

```text
src/modules/sftp/
  SftpTransferStack.tsx
  components/
    SftpFilePane.tsx
    SftpPaneToolbar.tsx
    SftpBreadcrumb.tsx
    SftpFileTable.tsx
    SftpConnectionDialog.tsx
    TransferQueue.tsx
    ConflictDialog.tsx
  lib/
    path.ts
    format.ts
    selection.ts
    transferDirection.ts
  store/
    sftpStore.ts
```

Responsibilities:

- `SftpTransferStack.tsx`: owns page layout and composes local pane, remote pane, queue, and dialogs.
- `SftpFilePane.tsx`: pane-level state for path, history, filter, selection, and actions.
- `SftpFileTable.tsx`: virtualized table rows and sorting.
- `TransferQueue.tsx`: transfer status display and actions.
- `sftpStore.ts`: frontend state for profiles, active connection, pane state, and transfer events.

## Design Acceptance Checklist

- [ ] The SFTP tab works as a full workspace, not a sidebar-only feature.
- [ ] Local and remote panes are visible at the same time on desktop.
- [ ] Each pane has independent path, filter, sort, and actions.
- [ ] Upload and download directions are visually obvious.
- [ ] Transfer queue remains visible while browsing.
- [ ] Host key warnings are blocking and clear.
- [ ] The design uses Kite theme tokens, not a copied Termius palette.
- [ ] The UI remains usable on a 1366px wide screen.
- [ ] No instructional wall of text appears inside the main UI.

## Visual Reference Notes From Termius

Keep:

- Dual-pane SFTP workspace.
- Local label on left and connection label on right.
- Independent Filter and Actions controls.
- Breadcrumb path rows.
- Dense file table with metadata.
- Permission string under remote folder names.

Adapt:

- Use Kite colors and icon system.
- Keep Kite tab bar and workspace chrome.
- Use existing file icons where possible.
- Add bottom transfer queue because Kite should make background work visible.

Avoid:

- Copying Termius branding.
- Making the page feel like a separate app inside Kite.
- Hiding transfer progress behind notifications only.

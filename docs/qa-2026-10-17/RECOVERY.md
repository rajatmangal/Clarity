# Backup and recovery verification

Implemented and checked locally on 2026-10-17 using synthetic temporary vaults. The personal vault and installed app were not modified. No installers were published.

## Delivered

Settings → Data & recovery separates automatic data snapshots from named vault backups and pre-restore safety copies. It supports validated previews, confirmation, replacement with a safety copy, portable ZIP export/import, verified restoration into a new folder, and all/filtered transaction CSV export. The startup failure screen also exposes recovery. Desktop builds have an Open backup folder action; browser/server mode shows the host path.

Automatic retention is the previous 30 saves, not 30 days. Named and safety copies do not rotate automatically. Portable backups include financial Markdown and supported notes/attachments, excluding hidden files/folders, backup history, symlinks, unsupported extensions, and Clarity’s separately stored credentials. ZIPs are plaintext/unencrypted. Copying them to another drive remains a user action.

## Automated verification

- `npm test`: 131 passing tests, including 10 new recovery/export tests.
- `npm run desktop:prepare`: production Next.js build and standalone runtime preparation passed.
- `npm run test:integration`: packaged HTTP server test passed against a separate temporary vault with authentication enabled. Covers token and authorization enforcement, named backup, ZIP/CSV export, damaged-table preview and repair, ZIP restoration into a new folder, persisted local configuration, old-vault preservation, cold startup with a missing required table, restoration from that condition, and lock cleanup after a later vault move.
- `node --check desktop/main.cjs` and `git diff --check` passed.

Recovery tests cover exact financial state and current Markdown preservation, split allocations, preferences, notes and binary attachments, restoring the pre-restore safety copy, stale previews, invalid backups, complete/incomplete older formats, 30-save rotation, external edit conflicts, journal recovery after interruption, nonempty/nested destinations, path traversal, case/Unicode clashes, file/folder clashes, encrypted/link/oversized ZIP entries, integrity/version validation, and CSV escaping/filtering without double counting split amounts.

## Browser walkthrough

Used an isolated localhost build at port 4315 with synthetic data, Chromium at 1440 × 1050 and 390 × 844, and no OpenAI key.

- Created a named backup through Settings and confirmed its success message and list entry.
- Opened a record/file preview; Restore stayed disabled until acknowledgement.
- Downloaded a vault ZIP and a CSV using the current filter scope.
- Selected that ZIP through the file input, reviewed it, restored it, and confirmed a new pre-restore safety copy appeared.
- Checked light and Midnight palettes, mobile page width, and the horizontally scrollable record comparison table.
- Removed a required table from the temporary vault, reloaded to the startup error screen, opened recovery, previewed a valid backup, and repaired the ledger through the UI.
- Confirmed unavailable exports/backups are disabled for an unreadable ledger, a new-folder restore requires a destination, and Escape cannot dismiss a running restoration.
- No browser page exceptions were observed.

Found and fixed during verification: restore normalization added whitespace to current Markdown; startup warning text used a cramped flex layout on mobile; recovery locks needed to follow later vault moves; normal reads needed to finish an interrupted restore before exposing records; portable filename and file/folder conflicts needed preflight rejection.

## Evidence

- [Desktop recovery screen](recovery-desktop.png)
- [Restore preview](recovery-preview.png)
- [Mobile recovery screen](recovery-mobile.png)
- [Dark recovery screen](recovery-dark.png)
- [Dark mobile restore preview](recovery-dark-mobile-preview.png)
- [Recovery from startup failure on mobile](recovery-startup-mobile.png)

## Verification limits

Native Finder/File Explorer opening is wired through Electron’s main-process bridge and passed syntax/build checks; an actual installed-app folder opening was not exercised here. No Windows installation or native Windows folder dialog was available in this session. Filename portability is covered by tests. These changes are local source/runtime changes, not an installer release.

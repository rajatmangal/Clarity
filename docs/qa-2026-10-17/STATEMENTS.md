# Statement history verification

Date: October 17, 2026.

## Delivered

- Statements navigation page with account filtering and date-range filtering.
- Import metadata, counts, warnings, fingerprints, and original transaction snapshots.
- Explicit statement coverage dates and confirmation during import.
- Duplicate-only statement recording without additional transactions.
- Account coverage cards, an annual month grid, editable manual confirmations, and no-activity confirmations.
- Coverage warnings in Overview and Analysis; changed financial records invalidate earlier confirmations.
- Undo previews distinguish unchanged, edited, and missing transactions. Edited records are preserved unless explicitly selected for deletion.
- Import history remains after undo; account mappings and learned categories remain intact.
- Three new Markdown files, with backup and migration of existing vaults.

## Automated verification

- `npm test`: 106 tests passed, including 13 statement-history tests.
- `npm run desktop:prepare`: production build and desktop runtime preparation passed.
- `npm run test:integration`: authenticated packaged-server read/write test passed, including import persistence, inconsistent-history rejection, and undo persistence.
- `git diff --check`: passed.

The new tests cover Markdown escaping and round trips, invalid periods, excluded/invalid rows, duplicate-only batches, preservation of edited or unrelated transactions, explicit deletion of edited records, overlapping and adjacent coverage periods, gaps, no activity, coverage invalidation, account deletion, corrupted references/counts, vault migration, note preservation, and missing history files.

## Browser verification

Used an isolated synthetic vault at `/tmp/clarity-statements-qa/vault` on port 4312. No real financial records were used.

1. Imported a synthetic CSV containing two purchases and income.
2. Inspected its history and confirmed complete monthly coverage manually.
3. Edited a purchase amount and category through Transactions.
4. Verified that affected financial coverage became Needs review.
5. Opened undo preview: two unchanged records and one edited record.
6. Executed default undo and verified that the edited purchase remained and the batch became Undone.
7. Confirmed an empty month as No activity from the annual grid.
8. Verified theme persistence and the Statements page in Midnight mode.
9. Checked 390px mobile and 1280px desktop layouts; document width matched viewport width, with no page overflow.

Evidence: [desktop](images/statements-desktop.png), [mobile](images/statements-mobile.png). The mobile image shows the same three-column grid used by the final build; subsequent styling changes refined desktop columns and month-input width.

## Limits

Earlier imports cannot be reconstructed reliably. Their transactions are preserved, but users must confirm their periods manually. Coverage reflects user confirmation, not reconciliation with a bank balance. Original CSV retention, configurable statement cadence, and scheduled reminders are not included in this increment. No release installers were created or published.

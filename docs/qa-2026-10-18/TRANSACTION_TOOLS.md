# Transaction tools — feature 10, stage 1

Implemented and verified locally on 2026-10-18. Tests used synthetic transactions in `/tmp/clarity-tools-ui/vault` on port 4316. The personal vault and installed app were not modified. No release was published.

## Delivered

- Bulk category, account, and review-status editing from the existing transaction selection controls.
- Leave unchanged defaults, mixed-value hints, and a two-step before/after preview.
- Split categories protected by default. Explicit inclusion changes allocation categories while keeping amounts, IDs, notes, and parent totals intact.
- Category edits skip income/transfers. Invalid account removal for expenses and incomplete split approvals are explained before saving.
- Mobile selection action bar with success messages positioned above its controls.
- Named saved views with search, type/review status, category, account, dashboard-following dates, rolling month/year, or fixed dates.
- View creation, applying, updating, renaming, confirmed deletion, duplicate-name errors, modified-filter indicators, and warnings for deleted references.
- Local persistence in SavedViews.md, safe old-vault migration, backend validation, and backup/ZIP recovery integration.

Tags, archived accounts, merchant aliases, inline editing, and keyboard shortcuts remain later stages of feature 10.

## Verification

- `npm test`: 141 passing tests, including 10 new transaction-tool tests.
- `npm run desktop:prepare`: production build and standalone runtime preparation passed.
- `npm run test:integration`: packaged authenticated HTTP server test passed, including saved-view persistence and malformed-view rejection, bulk edits on split purchases, unchanged original amounts, and ZIP/new-folder/cold-start recovery compatibility.
- `git diff --check` passed.

Unit coverage includes mixed selections, unselected-record protection, financial identity preservation, no merchant-rule changes, optional accounts for non-expenses, explicit split category changes, reviewed/needs-review toggling for manual records, invalid/stale/duplicate selections, split-aware search, deleted references, leap-year/rolling dates, view uniqueness/limits/schema validation, Markdown escaping/persistence, ZIP recovery, old-vault migration, and missing-file detection.

## Browser walkthrough

Chromium at 1440 × 1050 and 390 × 844, in Lavender and Midnight themes:

1. Selected purchases, a refund, income, and a split purchase together. Checked unchanged defaults and mixed hints.
2. Previewed category/account/review edits; confirmed default split exclusions and explicit allocation inclusion, then saved. Verified allocation amounts and notes remained intact.
3. Tried clearing accounts on the mixed selection; saw the expense-account error with Preview disabled.
4. Created a rolling monthly view, reloaded, applied it, and verified its filters and matching transaction count.
5. Checked duplicate-name errors, the modified-filter indicator, filter updates, and renaming.
6. Checked mobile width and bottom action placement. Saved review-state changes and verified the Needs review shortcut.
7. Checked Midnight colors and mobile preview width. Confirmed success notifications did not cover selection actions.
8. Deleted a saved view through confirmation and verified all four transactions remained.
9. Simulated a removed category in a saved view, verified the warning and empty result set, then repaired the reference through the filters and Manage dialog.

No browser page exceptions were observed. Visual checks prompted fixes for accessible field names, mobile notification overlap, and cramped saved-view dropdown width. Rolling views also activate the matching monthly/yearly dashboard controls.

## Evidence

- [Desktop transactions](images/transactions-desktop.png)
- [Choose bulk changes](images/bulk-choose.png)
- [Before/after preview](images/bulk-preview.png)
- [Save a view](images/save-view.png)
- [Mobile selection bar](images/transactions-mobile.png)
- [Full-width mobile saved-view dropdown](images/saved-view-mobile.png)
- [Mobile edit dialog](images/bulk-mobile.png)
- [Dark desktop](images/transactions-dark.png)
- [Dark mobile preview](images/bulk-dark-mobile-preview.png)
- [Missing-category warning](images/missing-view-filter-mobile.png)

Native Windows installation was not tested. Desktop-width and mobile checks were browser walkthroughs against the production localhost build.

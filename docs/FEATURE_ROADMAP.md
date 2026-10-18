# Clarity: Feature Roadmap and Product Specifications

Research date: October 17, 2026.

Status: proposed features, not a description of completed functionality. This document expands the twelve recommendations from the competitor review. Priorities are product recommendations, not release commitments.

## Product direction

Clarity helps people understand their spending, maintain realistic budgets, and track financial progress without signing up or connecting a bank account. Its core workflow should remain simple: import statements, resolve anything uncertain, and understand what changed.

All features below must support the desktop apps and the locally hosted website. Markdown files remain the persistent source of truth and should stay readable in Obsidian. No database, bank connection, mandatory AI service, or financial-data upload is required.

Local processing should handle deterministic tasks such as matching, calculations, rules, and recurring-payment suggestions. Optional OpenAI assistance must remain explicitly enabled and explain what information leaves the computer. Existing application update checks are separate from financial-data processing; avoid claiming that the app never makes any network requests.

### Suggested delivery order

1. Statement history, completeness, and import undo.
2. Split transactions.
3. Editable transaction rules.
4. Guided monthly review.
5. Recurring bills and subscriptions.
6. Budget history, rollovers, and savings targets.
7. Statement balance verification.
8. Linked transfers, refunds, and reimbursements.
9. Backup and recovery interface; deliver foundational backup safety alongside earlier features.
10. Faster editing, tags, saved views, and account archiving.
11. Additional import formats and improved transaction matching.
12. True multi-currency support.

This order favors trustworthy imports and less repetitive work. Dependencies can change implementation order: reconciliation needs an explicit opening-balance model, and multi-currency affects nearly every financial calculation.

## 1. Statement history and completeness

Implementation update (October 17, 2026): the first implementation adds a Statements page, account/range coverage cards, an annual month grid, manual period confirmations, history and warning details, duplicate-only import records, and undo with protection for edited transactions. Coverage changes to Needs review when its money records change. It uses three new Markdown files and migrates older vaults with a backup. Original CSV retention, configurable statement cadence, and scheduled missing-statement reminders remain future enhancements; in-app coverage warnings are included now. Earlier imports cannot be reconstructed reliably and require manual coverage confirmation. See [the user guide](USER_GUIDE.md#statement-history-and-completeness) for usage.

### Problem and current gap

Clarity saves import mappings, but users need a durable history of import batches and an explicit view of which account periods are complete. A low spending total may mean a missing statement rather than actual savings.

### Proposed experience

- Add an import history page, accessible from Accounts and Import.
- Show account, original filename, import time, statement period, imported count, duplicate count, skipped count, and warnings.
- Distinguish the statement's declared coverage from the earliest and latest transaction dates. A file containing purchases on September 5–24 does not prove that September 1–30 is covered.
- Ask for the statement period when the file cannot provide it reliably; remember the account's usual statement cadence.
- Show a compact account-by-month coverage view with complete, partial, missing, and user-confirmed no-activity states.
- Let users correct coverage and explain overlapping statement periods.
- Offer local reminders for missing statements, with snooze and dismiss controls.

### Import undo

Before undoing a batch, preview its remaining transactions, later edits, splits, and links. Default to removing only unchanged records created by that batch. Require an explicit choice for edited records and explain linked-record consequences. Never delete a pre-existing transaction merely because the batch matched it; store enough history to reverse import-driven updates safely.

### Local storage proposal

Add `ImportBatches.md` for batch metadata and `StatementCoverage.md` for coverage confirmations. Transactions need an import batch reference. Store change provenance for records updated during an import. Original statement retention should be optional, with a clear storage location and deletion control; filenames and hashes may be enough for basic history.

### Edge cases and acceptance criteria

- Reimporting an identical file shows its earlier batch and does not silently duplicate purchases.
- Overlapping files do not imply double coverage or double spending.
- Zero-transaction months can be confirmed complete without inventing transactions.
- Users can undo a batch without removing unrelated manual entries.
- Insights visibly flag incomplete account coverage instead of claiming spending decreased.

## 2. Split transactions

Implementation update (October 17, 2026): purchases and refunds can now be split in the transaction editor using amounts or percentages, with remainder assignment, optional notes, exact rounding, and validation. Category budgets, reports, search, and filters use allocations while ledger totals and duplicate detection keep the parent record. Splits are protected from merchant bulk edits and import undo, and are cleaned up during deletion. Data is stored in `TransactionSplits.md` with a backed-up migration for existing vaults. See [the user guide](USER_GUIDE.md#split-purchases-and-refunds).

### Problem and example

A single merchant can represent several purposes. A $150 Costco purchase may be $100 groceries, $30 household supplies, and $20 clothing. One category cannot represent it accurately.

### Proposed experience

- Add Split to the transaction editor for expenses and refunds.
- Keep the original transaction as the statement record and add allocation rows beneath it.
- Support exact amounts and percentage entry, showing the unallocated remainder live.
- Allow different categories, optional notes, and eventually tags on each allocation.
- Provide an explicit action to assign the remainder to a chosen allocation.
- Display a split indicator in the transaction list; expand it to inspect allocations.
- Allow removing a split and returning to one category with a preview.

### Calculation and storage rules

Add `TransactionSplits.md` with stable allocation IDs and a parent transaction reference. Store amounts in integer minor units. Percentage input must resolve to exact monetary amounts with visible rounding. Category reports and budgets use allocations; account totals and imports use the parent transaction. Never count both.

### Edge cases and acceptance criteria

- Allocations must equal the original amount before saving.
- Editing the parent amount requires rebalancing its allocations.
- Deleting the parent removes its allocations atomically; import undo understands this relationship.
- A refund may be split across the categories it reverses.
- Searching a category returns the appropriate allocation without making the entire purchase appear to belong to that category.
- Totals remain identical before and after a valid split.

Reference: [Lunch Money transaction features](https://lunchmoney.app/features).

## 3. Bills and subscriptions

### Problem and current gap

Historical spending does not show what is coming next. Users need visibility into rent, subscriptions, insurance renewals, and scheduled income without connecting their bank.

### Proposed experience

- Provide a Bills page with list and calendar views.
- Support manual weekly, fortnightly, monthly, quarterly, annual, and custom recurring schedules.
- Suggest possible recurring items from imported history, showing the evidence and requiring confirmation.
- Store expected merchant, amount or amount range, account if known, cadence, next due date, and reminder preference.
- Show upcoming commitments, annualized subscription cost, and confirmed price changes.
- Allow pausing, ending, skipping one occurrence, and changing a single occurrence without changing the whole schedule.
- Support scheduled income and transfers as distinct types.

### Matching and forecasting

Keep planned occurrences separate from actual transactions. Suggest matches by merchant, date window, account, and amount tolerance. A user confirms uncertain matches. Importing a bill must not add a second expense on top of its planned occurrence. Label projections as estimates based on known commitments and available data; do not imply live bank balances.

### Local storage proposal

Use `RecurringItems.md` for schedules and `RecurringOccurrences.md` for exceptions, due states, and transaction matches. Desktop reminders can use operating-system notifications. Explain that server/browser reminders depend on the app running and browser permissions; do not promise background delivery everywhere.

### Edge cases and acceptance criteria

- Monthly schedules on the 29th–31st have an explicit shorter-month policy.
- Amount changes do not alter historical paid occurrences.
- Similar merchants with multiple subscriptions are distinguishable.
- Cancelling a subscription stops future projections without removing its history.
- A matched occurrence contributes actual spending once.

References: [Lunch Money recurring items](https://lunchmoney.app/features/recurring-expenses/), [Monarch recurring payments](https://www.monarch.com/track-recurring-bills-and-subscriptions).

## 4. Editable transaction rules

### Problem and current gap

Clarity remembers approved merchant categories. More precise rules are needed when the same merchant has different uses or statement descriptions contain useful distinctions.

### Proposed experience

- Add a Rules page and a Create rule action from transaction editing.
- Support conditions for description or merchant, exact/contains/starts-with matching, account, transaction type, and amount or range.
- Support setting category, normalized merchant, tags, and review status; split actions can follow once splits exist.
- Examples: `UBER EATS` becomes Dining; `UBER TRIP` becomes Transport; a merchant on a business account receives a Work tag.
- Provide priority ordering, enabled/disabled state, and an explicit stop-processing option.
- Preview affected records and before/after values before applying a rule to history.
- Explain why a transaction was categorized, including the matching rule.

### Safety and precedence

Define a consistent precedence: explicit user edits remain protected unless included in a historical preview; user-defined rules take priority over learned suggestions; AI is a fallback only when enabled. Rules must respect allowed fields for each transaction type. Conflicting rules must have deterministic results. Avoid unrestricted regular expressions in the first version.

### Local storage proposal

Extend or migrate `MerchantRules.md` into a versioned, readable rule format. Preserve existing approved merchant behavior during migration. Record rule IDs in transaction provenance so users can inspect decisions and reverse bulk changes.

### Acceptance criteria

- Preview and actual execution produce the same result for the same state.
- Users can disable a rule without changing historical transactions.
- Applying rules does not silently overwrite protected manual categorizations.
- All standard rule processing works offline with no OpenAI key.

Reference: [Lunch Money rules engine](https://lunchmoney.app/features/rules).

## 5. Rollover budgets and savings targets

### Problem and current gap

Clarity supports regular budgets and temporary month overrides. It needs historical budget versions, accumulated allowances for irregular spending, and goal-based contributions.

### Proposed experience

- Keep simple monthly budgets as the default.
- Offer optional rollover of unused allowance, with a separate choice about carrying overspending forward.
- Let users start rollover from a chosen month and inspect the opening amount, additions, spending, and closing amount.
- Add targets with a name, target amount, optional deadline, current allocation, and planned contribution.
- Support both adding a fixed contribution each period and refilling an allowance to a fixed amount.
- Example: set aside $100 per month for a $1,200 annual insurance payment.
- Show progress and a suggested contribution when a deadline changes or a contribution is missed.

### Historical accuracy

Regular budget edits need effective dates. Offer This month only, From this month onward, and a clearly explained historical correction action. Preserve old budgets so prior reports do not change unexpectedly. Define how existing month overrides interact with a new regular plan.

### Calculation and storage rules

Use `BudgetPlans.md` for effective-dated plans, retain `BudgetOverrides.md` for exceptions, and add `Goals.md` plus `GoalAllocations.md` if contributions need history. Rollover calculations should be reproducible from these records rather than hidden state. Explain that budget allocations are plans, not extra cash or additional net worth. Combined parent and child budgets must never spend or fund the same amount twice.

### Acceptance criteria

- Changing November's plan does not change October's original comparison.
- A $100 allowance with $70 spent produces $30 carryover when positive rollover is enabled.
- Negative rollover follows the user's chosen policy and is visible.
- Temporary overrides have clear interaction with rollover and can be restored.
- Deleting a goal does not delete real transactions or account balances.

Reference: [YNAB target types and contribution behavior](https://support.ynab.com/how-to-use-targets-rk5kkI9ks).

## 6. Statement balance verification

### Problem and current gap

Clarity's manual balance snapshots track net worth independently of transactions. They do not currently demonstrate that an account's transaction history matches its statement.

### Proposed experience

- Add Verify statement to an account or import batch.
- Ask for statement dates, opening balance, closing balance, and optional statement totals.
- Calculate the expected closing balance using the account's explicit asset or liability convention.
- Show the discrepancy and let users compare statement entries with imported transactions.
- Introduce cleared and reconciled states separately from category-review status.
- Allow saving an unfinished verification and returning later.
- Mark a period verified only after the discrepancy is zero or a clearly recorded adjustment is explicitly approved.

### Local storage proposal

Add `Reconciliations.md` with dates, statement balances, matched transaction references, status, and completion time. Define opening balances explicitly. Keep reconciliation records distinct from independent valuation snapshots, especially for property or investments.

### Edge cases and acceptance criteria

- Credit-card repayments, fees, interest, and refunds use tested liability arithmetic.
- Pending purchases outside the statement are not forced into the cleared total.
- Editing or deleting a reconciled transaction warns the user and marks affected verification as needing review.
- No hidden balancing transaction is inserted automatically.
- Transfers without an account cannot participate until their account is assigned.
- The UI explains the difference between reviewed, cleared, and reconciled.

Reference: [Actual Budget reconciliation](https://actualbudget.org/docs/accounts/reconciliation/).

## 7. Linked transfers, refunds, and reimbursements

### Problem

Moving money between accounts, receiving a refund, and collecting shared expenses are different events. Treating them as ordinary income or unrelated transactions can distort spending and cash-flow reports.

### Proposed experience

- Suggest linking opposite sides of a transfer using amount, account, and nearby dates.
- Show credit-card repayments as money movement, excluded from purchase spending.
- Link full or partial refunds to original purchases, with suggested category allocation.
- Record a reimbursable amount and optional person or organization against an expense.
- Track expected, partially received, received, and written-off reimbursement states.
- Example: a $120 dinner has an $80 reimbursement expectation, leaving $40 personal cost after settlement.
- Allow unlinking with a preview; users may keep a transfer unlinked when only one account is tracked.

### Reporting and storage rules

Add `TransactionLinks.md` and `Reimbursements.md`. Preserve actual money movement and dates. Offer clearly labeled gross spending and net personal cost rather than silently replacing one with the other. A refund posted in a later month belongs to that month's cash flow; an optional original-purchase analysis must be labeled separately. Linking a transfer must not erase either account's statement entry or count it as income.

### Acceptance criteria

- Several partial refunds cannot exceed the purchase without an explicit exception.
- A reimbursement cannot settle multiple expenses beyond its total amount.
- Partial payments and cross-month settlements remain traceable.
- Deleting linked records requires resolving the relationship.
- Transfer fees can be recorded separately from the amount moved.

Reference: [Actual Budget transfers](https://actualbudget.org/docs/transactions/transfers/).

## 8. Guided monthly review

### Problem

Charts alone do not tell users whether their month is complete or which action to take. Clarity needs a short, explainable review rather than a larger default dashboard.

### Proposed flow

1. Check statement coverage for active accounts and mark no-activity periods explicitly.
2. Resolve uncategorized records, possible duplicates, and uncertain merchant matches.
3. Review major spending changes and budget exceptions.
4. Record or verify relevant account balances.
5. Set next month's changes and mark the review complete.

Users can skip steps with an explanation and resume later. The summary should distinguish complete, incomplete, and intentionally excluded accounts. Preserve the app's existing behavior that manually entered transactions are reviewed; a month review is a separate concept.

### Useful insight rules

- Compare month-to-date with the same elapsed days of the previous month and label the exact periods.
- Handle unequal month lengths explicitly; never invent days for February.
- Offer a complete-month comparison separately.
- Explain major changes through contributing transactions and merchants.
- Let users label one-time expenses and toggle whether they appear in trend comparisons, without removing them from actual totals.
- Suppress conclusions when coverage is missing or the comparison sample is too small.
- Every insight opens the filtered records and shows its calculation basis.

### Storage and acceptance criteria

Add `MonthlyReviews.md` for step completion, exclusions, notes, and the data revision reviewed. Reopen or flag affected reviews after material edits or new imports. Calculated summaries can be regenerated locally. A user must be able to finish a review without AI, and incomplete data must never receive an unqualified All complete label.

## 9. Visible backup and recovery

**Implemented locally, 2026-10-17.** Settings now lists validated automatic, named, legacy, and safety restore points, with previews and explicit confirmation. Includes current-vault restoration, ZIP export/import, verified restore into a new folder, filtered/all transaction CSV export, and desktop backup-folder access. Recovery remains accessible when the ledger cannot open. Automatic data snapshots retain the previous 30 saves; named and safety vault backups remain outside that rotation. ZIPs contain financial Markdown and supported notes/attachments, excluding hidden files, backup history, and Clarity’s separately stored credentials. See [the user guide](USER_GUIDE.md#backups-recovery-and-exports) for limits and recovery behavior. Installer publication is separate from these local changes.

### Problem and current gap

Clarity already creates local backup files. Users need a safe way to discover, inspect, and restore them without handling files manually.

### Proposed experience

- Add Data and recovery in Settings.
- Show backup time, vault location, retention policy, and whether a backup represents a complete vault or individual files.
- Preview record-count changes before restoration and explain any uncertainty in older backup formats.
- Create a complete safety snapshot before restoring.
- Support full-vault ZIP export and validated restore into a new folder.
- Offer transaction CSV export with documented columns and explicit scope: current filters or all transactions.
- Keep a pre-restore safety copy so a completed restore can be undone. Interrupted writes resume through the save journal before another read/save; conflicting external edits are preserved and reported.

### Safety and privacy

Restore must be transactional across related files and compatible with the existing vault lock. Validate schema versions and relationships before replacing active data. Reject unsafe archive paths and unexpected executable content. Never export API keys, `.env`, desktop credentials, or unrelated files by default. A backup beside the original vault is useful for mistakes but is not protection from disk failure; explain how to copy it to another location.

### Acceptance criteria

- A complete exported vault can be restored into an empty folder with matching financial totals and preferences.
- Older single-file backups are not presented as complete restore points.
- An interrupted restore leaves the original or fully restored state, not a mixture.
- Users can locate backup files through Finder or File Explorer.
- Exported CSV safely handles delimiters, quotes, line breaks, and spreadsheet formula-like text.

## 10. Faster everyday editing

**Stage 1 implemented locally, 2026-10-18:** bulk category/account/review-status editing with mixed-value hints, explicit split-allocation inclusion, a before/after preview, and mobile selection controls. Saved views now support search, type/review status, category, account, following dashboard dates, rolling month/year, and fixed ranges. View creation, updating, renaming, deletion, and missing-reference warnings persist through `SavedViews.md`, migration, backups, and ZIP restore. See [the user guide](USER_GUIDE.md#bulk-editing-and-saved-transaction-views).

**Later stages remain planned:** tags and allocation tags, archived accounts, merchant aliases, inline editing, and keyboard shortcuts. This stage does not add those features.

### Proposed improvements

- Bulk edit category, account, tags, and review state with a before/after summary.
- Use the existing transaction editor consistently for individual changes; consider inline editing for simple fields with clear save/cancel behavior.
- Save named filters such as Uncategorized, Work expenses, or This month's dining.
- Add keyboard shortcuts for common actions, with a discoverable help panel and no interference with text entry.
- Add tags that cross category boundaries, such as Vacation, Renovation, or Work.
- Archive accounts to hide them from routine entry while preserving their transactions and historical reports.
- Add merchant aliases and a preview when merging names; preserve original statement descriptions.
- Keep mobile selection and bulk controls usable without widening the entire page.

### Local storage proposal

Use `Tags.md`, `TransactionTags.md`, and `SavedViews.md`. Extend account records with archival metadata. Merchant alias records should preserve the distinction between raw descriptions and normalized names. Split allocations may need their own tags; define this without implicitly applying every allocation tag to the full parent amount.

### Acceptance criteria

- Mixed selections show mixed values rather than an arbitrary first record's value.
- Invalid bulk edits are explained before any record changes.
- Archived accounts remain included in appropriate historical totals and can be restored.
- Saved views survive restart and handle deleted categories gracefully.
- Keyboard operations and icon buttons have accessible labels and focus behavior.

Reference: [Lunch Money categories, tags, and transaction utilities](https://lunchmoney.app/features).

## 11. Additional formats and better matching

### Problem and current gap

CSV is flexible but often lacks stable transaction IDs and consistent dates. Clarity should reduce mapping work and avoid duplicates when manual transactions later appear in statements.

### Proposed experience

- Add OFX/QFX first, then evaluate QIF and CAMT based on real user files.
- Allow selecting multiple files, assigning each to an account, and reviewing a combined import plan.
- Recognize compatible saved profiles by headers and account context, but ask when several profiles fit.
- Display uncertain matches side by side with date, merchant, amount, and account differences.
- Match manual entries to imported records while preserving user categories, notes, splits, and stable references.
- Offer Keep both when two similar purchases are legitimate.
- Remember intentional exclusions so deleted imports do not silently reappear, with an explicit reimport option.

### Matching and storage rules

Prefer trustworthy source transaction IDs scoped to their account. Otherwise generate suggestions from amount, date window, merchant similarity, and transaction type. Do not automatically collapse repeated same-day purchases based on similarity alone. Record original values and merge decisions in import provenance. All parsing and matching should happen locally.

### Edge cases and acceptance criteria

- Account IDs in files are treated as sensitive data and are not sent to AI.
- Parsers reject unsafe XML features and handle malformed files without partial writes.
- Ambiguous dates remain user-resolvable, with examples of the resulting dates.
- Multiple-file imports identify duplicates both against the vault and across the selected files.
- Matching preserves user work and offers a reversible merge.
- Unsupported formats get an actionable message rather than an empty successful import.

Reference: [Actual Budget financial-file imports and duplicate matching](https://actualbudget.org/docs/transactions/importing/).

## 12. True multi-currency support

### Problem and current gap

Clarity currently tracks one currency per vault. Choosing a different currency symbol does not convert money. True CAD, USD, and INR tracking requires original amounts and explicit conversion data.

### Proposed experience

- Set a home reporting currency and a currency for each account.
- Preserve each transaction's original amount and currency.
- Allow manual exchange rates and show the date and source used for conversion.
- For foreign purchases on a domestic card, capture the actual settled domestic amount when available; prefer it over an estimated conversion.
- Keep online rate retrieval optional, with clear disclosure that it makes an external request.
- Show both original and converted values, with visible estimated or missing-rate indicators.
- Preserve CAD, USD, and INR as favorites without restricting other supported currencies.

### Calculation and storage rules

Add `ExchangeRates.md` with currency pair, effective date, precision, and provenance. Use currency-specific minor-unit rules instead of assuming two decimal places everywhere. Historical spending should use a defined transaction-date conversion policy; net worth should use a defined valuation-date policy. Never silently combine currencies when a rate is missing. Historical saved conversions should not change merely because today's rate changes.

### Cross-currency transfers

Link the source and destination amounts separately, including actual conversion and fees. Do not require the numeric amounts on both sides to match. Distinguish foreign-exchange valuation changes from income or spending. Goal allocations and budgets need a defined currency and conversion policy.

### Acceptance criteria

- A USD transaction remains USD in storage even when reports display CAD.
- Missing rates produce a visible incomplete total, not a fabricated conversion.
- Manual rates support a fully offline workflow.
- Existing vaults migrate without relabeling or numerically changing historical amounts.
- Changing the home reporting currency requires a preview and does not rewrite original records.

Reference: [Lunch Money multi-currency feature overview](https://lunchmoney.app/features).

## Shared implementation requirements

### Markdown persistence and migrations

The filenames above are proposals, not implemented schemas. Confirm the final relationships before extending the store. Give every linked record a stable ID, version migrations explicitly, preserve user-authored notes, and back up a vault before migration. Multi-file changes must retain the existing concurrency and crash-recovery protections. Validate manual edits to Markdown and report broken references clearly.

### Usability and accessibility

Use progressive disclosure: basic entry stays short, advanced options expand when needed. Required fields come before optional ones. Every create, edit, delete, import, restore, and bulk action needs a clear success or error message. Support keyboard navigation, readable contrast, all themes, touch targets, and narrow mobile layouts. Charts need text explanations and useful empty states.

### Verification approach

Test monetary invariants, transfer and liability arithmetic, migration compatibility, reversible changes, interrupted writes, and relationships across files. Manually verify the primary desktop and mobile flows with synthetic data. Include repeated purchases, partial refunds, overlapping imports, leap dates, short months, and malformed files. Do not test against or modify a user's real vault by default.

### Features intentionally outside this roadmap

Bank connections, mandatory cloud accounts, investment trading, tax filing, and multi-user concurrent editing are not included. A spending forecast is an estimate based on recorded data, not a guarantee of available funds. Application locking and vault encryption are separate concepts: an app password must not be described as encrypting readable Markdown files.

## Research notes

The cited official product and documentation pages informed the comparison. The proposed Clarity workflows, storage files, priorities, and acceptance criteria are recommendations adapted to its local-first architecture; they are not claims that every competitor implements these details. Competitor capabilities may change after the research date.

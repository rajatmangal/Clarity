# Split transaction verification

Date: October 17, 2026.

## Delivered

- Split new or existing purchases and refunds into 2–100 category allocations.
- Amount or percentage entry, optional allocation notes, and remainder assignment.
- Exact integer monetary totals; percentage rounding distributes the final cents deterministically.
- Validation prevents zero allocations, missing categories, invalid percentages, and mismatched totals.
- Switching to a single category removes allocations only on save. Cancelling preserves the saved split.
- Transaction rows expand to show allocations. Category filtering labels the selected share beneath the original full amount; allocation categories and notes are searchable.
- Budgets, category charts, merchant analysis, daily spending, and averages use allocations without counting a purchase multiple times.
- The original statement record remains the source for account totals and duplicate detection.
- Merchant learning and bulk category edits do not flatten splits.
- Transaction/account deletion cleans up allocations; category deletion reassigns them and flags Uncategorized allocations for review.
- Import undo protects a transaction split after import; explicitly removing edited records also removes their allocations.
- `TransactionSplits.md` stores the allocations. Existing vaults receive a backup during migration, and missing migrated files fail safely.

## Automated verification

- `npm test`: 119 tests passed, including 13 new split tests.
- `npm run desktop:prepare`: production build and desktop runtime preparation passed.
- `npm run test:integration`: packaged-server test passed, including persisted splits, rejection of unbalanced allocations, and allocation cleanup during import undo.
- `git diff --check`: passed.

The split tests cover Markdown round trips, original record preservation, expense/refund arithmetic, combined category budgets, selected-category amounts, unique purchase counts and averages, exact percentage rounding including large totals, invalid and orphan allocations, merchant-rule protection, account/category deletion, conversion back to one category, duplicate matching, statement coverage, import undo, migration, and missing files.

## Browser verification

Used synthetic records only in `/tmp/clarity-splits-qa/vault`, on localhost port 4313.

1. Edited a $150 imported purchase into $100 groceries and $50 shopping, with a note.
2. Tried an incomplete allocation and verified an error prevented saving; used Assign remaining here to finish it.
3. Expanded the saved allocations and filtered by groceries: the row retained its $150 original total and showed $100 in the selected category.
4. Created a $30 refund with no account and percentage allocations of 66.67% and 33.33%; the preview and saved amounts were $20 and $10.
5. Verified dashboard net spending of $120, groceries of $80, shopping of $40, and one purchase counted.
6. Removed the refund split, selected a single category, and saved successfully.
7. Reopened the purchase split and changed its total to $160 without changing allocations; saving was blocked with a balance error. Restored/cancelled the temporary edit.
8. Verified partial percentages convert back to amounts without clearing entered allocations.
9. Verified a $0.01 allocation in a $10,000 draft prevents switching to insufficiently precise percentages and preserves the amount entry. Cancelled this test draft.
10. Verified saved allocations survive restart and reopening the editor.
11. Checked dark-theme layouts at 1280px desktop and 390px mobile. The mobile dialog had matching client and scroll widths of 372px, without horizontal overflow.

Evidence: [desktop editor](images/splits-desktop.png), [mobile editor](images/splits-mobile.png).

No real vault data was edited. No installers were generated or published.

## Direct Split action and over-allocation update

- Added a Split icon between Edit and Delete for purchases and refunds. It opens an allocation-only dialog with the original transaction amount fixed; existing splits open in the same dialog.
- Over-allocation now displays the exact excess and disables Save split immediately. The regular transaction editor uses the same guard. Backend validation still rejects mismatched totals.
- Verified a $150 purchase with $100 + $60 allocations: a $10 excess error appeared and Save split was disabled. Correcting $60 to $50 enabled saving and persisted the split.
- Verified a refund at 75% + 30%: a 5% excess error appeared and saving was disabled. Correcting it to 75% + 25% allowed saving.
- Verified mobile Edit/Split/Delete actions at 390px with no horizontal overflow.
- `npm test`: 121 tests passed. `npm run build` and `git diff --check` passed.
- Used a separate synthetic vault at `/tmp/clarity-split-actions-qa/vault`, port 4314.

Evidence: [over-allocation error](images/split-over-allocation.png), [mobile row actions](images/split-actions-mobile.png).

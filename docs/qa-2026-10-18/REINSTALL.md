# Existing-vault reopening after reinstall

Implemented locally on 2026-10-18. The app’s existing desktop first-launch chooser already allowed selecting a previous folder. Added a preview-and-open flow to onboarding and Settings, independent of Move vault, so an occupied existing vault can be reused in place.

## Checks

- `npm test`: 147 tests passed, including six new existing-vault test groups.
- `npm run desktop:prepare`: production build and standalone runtime preparation passed.
- `npm run test:integration`: authenticated packaged-server tests passed, including reopening a previous-install vault, preserving source and destination records, switching locks, persisting the location, and restarting with that location.
- `node --check desktop/main.cjs` and `git diff --check` passed.

Unit tests cover saved records/preferences, notes, byte-preserved current transaction tables, restart persistence, current-folder reopening without relocking, non-vault/empty/partial/symlink rejection, active locks, stale previews, configuration-write failure, preview without migration writes, and legacy migration with a backup.

## Browser walkthrough

A fresh synthetic vault at `/tmp/clarity-reinstall-ui/fresh-vault` was opened on localhost port 4317. Setup was given a different name and CAD, then Open existing vault selected `/tmp/clarity-reinstall-ui/previous-vault`.

- Preview showed the old profile, USD currency, and saved record counts.
- Opening skipped the unfinished setup choices and loaded the original profile, Midnight theme, USD currency, and purchase.
- Compared Transactions.md before and after: byte-for-byte unchanged.
- The fresh folder remained intact with zero transactions; no merge or move occurred.
- An unrelated folder with a text file was rejected and gained no ledger files.
- Reopened the same folder from Settings at 390px, with no dialog overflow.
- No browser page exceptions were observed.

The same native folder-picker helper is wired to the new dialog. Native Finder/Windows picker operation was not exercised in this headless browser walkthrough. No installer was published, and the user’s vault or installed app was not modified.

Evidence: [desktop preview](images/open-existing-vault.png), [mobile preview](images/open-existing-vault-mobile.png).

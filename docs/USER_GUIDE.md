# Clarity user guide

**See your spending. Plan your saving.**

A local personal-finance dashboard built with Next.js, React, Recharts, and Lucide. CAD is the default. No database server or bank connection is required.

## Run

Requires Node.js 22 or newer.

```sh
npm install
npm run dev
```

Open http://localhost:4310. For a production build, run `npm run build` followed by `npm start`. By default, both scripts bind only to 127.0.0.1. Use one server process per vault.

## Import statements

Choose a bank/debit or credit-card statement, an account, and a CSV. Map the header row, date/description/amount columns, decimal separator, and purchase sign. Separate debit/credit columns are supported. Preview includes invalid rows, duplicate candidates, refunds, and suspected transfers. No transactions are saved until you import selected rows.

Successful imports save their configuration per account. Next time, select that account and upload the CSV to go directly to preview. Saved column names are matched even if columns move; missing or duplicate headers require editing. Use **Edit settings** during import, or **Accounts → Edit import settings**, to change the saved configuration. Changes affect future imports only. One configuration is retained per account.

### Statement history and completeness

The last preview step asks for the statement's actual start and end dates. Suggested dates are the first and last readable transaction; extend them to the dates printed on your statement, including days without purchases. Check the confirmation only if the file covers that entire period. Excluding new rows or skipping invalid rows records partial coverage. Possible duplicates that were already recorded do not prevent confirmation.

Open **Statements** to see import time, filename, account, period, counts, and warnings. A fingerprint identifies previously recorded CSV text for the same account. The original CSV is not copied into the vault. A duplicate-only upload can be recorded with **Record statement only** without creating transactions.

The account cards show completeness for the selected monthly, yearly, or custom range. The annual grid shows each month's status. Overlapping and adjacent confirmed periods are combined, but gaps remain partial. Use **Confirm a period** to record complete coverage, partial coverage, or explicitly confirmed no activity. No activity requires an empty period; an empty ledger alone never proves completeness. Coverage is a user confirmation, not a verification against your bank's balance.

Editing an amount, date, transaction type, or account, or adding/deleting records in a confirmed period, changes its status to **Needs review**. Category, merchant, and review-status edits alone do not invalidate coverage. Reconfirm after checking the affected records. Overview and Analysis warn when accounts lack full confirmed coverage.

Imports made before this feature do not have reliable batch history. Existing transactions are preserved; confirm their periods manually. Your vault is backed up before the new history files are created.

### Undo an import

Choose **Statements → Undo import** to inspect unchanged, edited, and already deleted transactions. Unchanged transactions created by that batch are removed. Edited transactions are kept by default; an explicit checkbox allows deleting them too. The preview shows the edited records and final deletion count before confirmation.

Undo retains its audit history and stops its statement coverage from counting. Other overlapping confirmations may need review if their records changed. Pre-existing transactions, balance snapshots, accounts, saved import settings, and learned merchant categories are retained. An undone batch cannot be undone again. To import it again, select the CSV; normal duplicate checks still apply to records you kept.

### Dates

Automatic parsing accepts named months (including `13 Oct 2026`, `October 13th, 2026`, `13Oct2026`), year-first dates, unambiguous numeric dates, common separators, compact `YYYYMMDD`, and dates with times or weekday prefixes. Select Day first / Month first / Year first for ambiguous numeric dates or compact dates such as `13102026`.

Month names support English, French, German, Spanish, Italian, Portuguese, and Dutch. Select the statement's language. Full/abbreviated names, case variations, and accents are recognized.

Two-digit years 00–68 mean 2000–2068; 69–99 mean 1969–1999. Yearless dates require an explicit statement year. For statements spanning December and January without years, add the years to the CSV or import the two years separately. Invalid dates never roll forward into another month.

Explicit modes cover Excel/Google Sheets serials (1900 system), Excel's 1904 system, Unix seconds, and Unix milliseconds. Serial 60 in the 1900 system is rejected because February 29, 1900 did not exist. Time fractions in spreadsheet dates are discarded. Date strings retain the printed calendar date; Unix timestamps use UTC.

Custom formats use strict, case-sensitive [Day.js parsing tokens](https://day.js.org/docs/en/parse/string-format), e.g. `DD MMM YYYY`, `MMM D, YYYY`, `DD/MM/YYYY HH:mm:ss`, or `YYYY年MM月DD日`. A year token is required. Use automatic mode for ISO timestamps with offsets. A live date preview shows conversions before import. No parser can infer every bank-specific convention safely; use the custom format or edit the CSV for unusual exports.

## Bulk editing and saved transaction views

In **Transactions**, select individual rows or **Select all matching transactions**. Select all includes matches on every page, not just the visible 25 rows. Changing the search, type, category, account, or date range clears selection. On mobile, selection opens a compact bottom action bar.

Choose **Edit selected** to change category, account, or review status. All fields begin with **Leave unchanged**; current values show **Mixed values** when appropriate. Category changes apply to expenses and refunds. Income and transfers are skipped for category edits, while other chosen changes still apply. Expenses require an account, so a mixed selection containing expenses cannot be changed to No account.

Split categories stay unchanged by default. To change them together, choose a category and explicitly enable **Also change every selected split allocation**. Every allocation receives that category, while allocation amounts, notes, IDs, and the original transaction total remain intact. Use the individual Split action when only some allocations should change. A split with an Uncategorized allocation cannot be marked reviewed until every allocation has a category.

**Preview changes** shows the affected transactions, before/after values, allocation categories, skipped category edits, and unchanged records. Use Back to adjust your choices. **Save changes** writes the whole update together with the existing revision protection and automatic backup. Amounts, dates, kinds, descriptions, and saved merchant rules are preserved. Category and account reports reflect the new classifications. Mark as needs review also works for manually entered or previously reviewed transactions. Existing import undo protections still treat edited imported records as edited records.

The **Your views** bar offers Needs review and Uncategorized shortcuts, plus **Save view** for a named combination of search, type/review status, category, account, and date behavior. Choose among:

- **Follow the dashboard’s selected range** to reuse filters with any month/year/range.
- **This month** or **This year** to advance dates automatically when you apply the view later.
- **Keep this exact range** to retain fixed start/end dates.

Choose a view from the dropdown to apply it. Adjusting filters displays **Filters adjusted** without overwriting the saved view. **Manage** saves your current filters under the same view, renames it, or deletes it after confirmation. Deleting a view leaves transactions intact. View names are unique, with a maximum of 100 views and 60 characters per name. Saved views live in **SavedViews.md**, survive restart, and are included in backups and ZIP recovery. Upgrading an older vault adds that table after backing up the old files. If a referenced category or account is deleted, its filter shows a warning and no matching results; choose a replacement and update the view rather than silently broadening it.

## Split purchases and refunds

In **Transactions**, click the **Split** icon between **Edit** and **Delete** on a purchase or refund. It opens an allocation-only dialog with the original amount fixed. Use the same action to manage an existing split. When adding a new transaction, **Split across categories** is also available in the entry form. Enter at least two allocations. Each needs a category and a positive amount; notes are optional. Use **Add allocation** for more rows and **Assign remaining here** to fill one row with the unallocated balance.

Choose **Percentages** to enter shares instead of amounts. Percentages must total exactly 100%. Clarity displays the rounded monetary amounts before saving and distributes rounding so they equal the original total exactly. Switching between amounts and percentages can round entry values; check the displayed amounts before saving. Each saved allocation must receive at least one cent. Over-allocation immediately shows the exact excess amount or percentage and disables saving until corrected. The original total cannot be exceeded.

The original transaction remains one record with its date, account, description, merchant, and full amount. Category budgets and reports use the allocations; account totals and CSV duplicate checks use the original record. Refund allocations reduce spending in their selected categories. Split refunds can have no account, just like ordinary refunds.

The transaction list shows **Split · N allocations**. Expand it to see categories, amounts, and notes. Filtering by a category keeps the original transaction visible and labels the amount belonging to the selected category beneath its full total. Allocation category names and notes are searchable.

Changing the original amount requires amount-based allocations to be rebalanced before saving. In percentage mode, the allocated amounts are recalculated from the new total. To remove a split, choose **Use one category instead**, select a category for the full amount, and save. Cancel leaves the existing split unchanged. Remove the split before switching the transaction to income or transfer.

Split choices do not overwrite remembered merchant categories, and bulk merchant categorization excludes split transactions. Deleting a transaction, including bulk deletion, also deletes its allocations. Deleting a category reassigns affected allocations; moving them to Uncategorized marks the split as needing review.

If an imported transaction is split afterward, **Undo import** treats it as edited and keeps it by default. Explicitly deleting edited records during undo also removes their allocations. Changing only category allocations does not invalidate statement coverage because the account's money records have not changed.

Allocations are stored locally in `TransactionSplits.md`. Existing vaults receive a backup when this file is introduced. Do not delete it manually; it is part of the vault's financial data.

## Markdown storage

The default vault is `vault/`. Open it in Obsidian. Its tables are the source of truth:

- `Accounts.md`: account identities and types.
- `Transactions.md`: purchases, income, refunds, transfers, original descriptions, and separate merchant/location/reference fields.
- `TransactionSplits.md`: allocation IDs, parent transaction IDs, categories, monetary amounts, and optional notes.
- `Balances.md`: dated account balance snapshots.
- `Categories.md`: category labels, parents, colors, monthly budgets, and combined/separate budget mode.
- `ImportProfiles.md`: saved per-account CSV and date configuration.
- `ImportBatches.md`: statement file fingerprints, import dates, periods, counts, warnings, and undo status. Historical account names are kept even if the account is deleted.
- `ImportEntries.md`: stable transaction references and original snapshots used to protect later edits during undo. Snapshots contain original transaction fields with amounts in minor units.
- `StatementCoverage.md`: confirmed or partial periods, no-activity confirmations, notes, and financial-record snapshots used to detect later changes.
- `Settings.md`: currency, model, and theme preferences.
- `MerchantRules.md`: remembered merchant-to-category choices.
- `BudgetOverrides.md`: category limits for individual months and their reasons.
- `ChartPreferences.md`: pinned and hidden Analysis charts.
- `SavedViews.md`: named transaction filters and rolling or fixed date behavior.
- `Money.md`: an Obsidian index and your original notes.

Existing single-file ledgers migrate automatically. The original `Money.md` is backed up before migration. Records keep their IDs, and original notes remain in the index. Each table has a notes section preserved on saves. Preserve table headers, managed markers, and IDs when editing. Reload the dashboard after external edits; conflicting saves are rejected.

Amounts in Markdown use currency units with two decimals; calculations use integer cents. Import profile column indices are zero-based and the header row is one-based. Saved headers are a JSON array inside a Markdown table cell. A tab delimiter is escaped as `&#9;`.

A `.pending-save.md` journal makes interrupted multi-file writes recoverable. The app finishes a pending save on restart before reading records. If a pending write conflicts with a manual edit, it stops and preserves both versions for recovery. `.backups/` retains the latest 30 complete table snapshots plus the original migration backup. Files are local plaintext; back up or encrypt the vault as appropriate. Do not edit during a save or run multiple servers against the same vault.

## Backups, recovery, and exports

Open **Settings → Data & recovery**. Everything in this screen operates locally (on your host machine in server mode).

- **Automatic snapshots** save the previous financial Markdown tables and index before every save. Clarity retains the latest **30 saves, not 30 days**. These snapshots include notes inside the financial tables, but not separate notes or attachments.
- **Back up now** creates a named vault restore point containing financial Markdown, separate notes, and supported attachments. Named backups and pre-restore safety copies are **not** removed by the automatic 30-save rotation. They remain under `.backups/`; remove unwanted copies through your file manager.
- **Preview restore** validates the backup and shows before/after record counts, additions, removals, changed records, currency, included files, and warnings about older formats. A preview expires after ten minutes. If current files change, preview again before replacing them.
- **Replace the current vault** keeps a full supported-file safety copy first, then restores the selected records and included files. Extra current-only notes and attachments remain. To undo a completed restore, preview and restore its **Before restore — recovery copy**. A safety copy of already damaged data is retained for manual inspection, but may not itself be a valid restore point.
- **Restore into a new folder** accepts a new or empty folder outside the current vault. Clarity verifies the restored copy, saves its location locally, and switches to it. The previous vault stays intact. This differs from **Move vault**, which moves the existing vault and removes the old copy after verification.
- **Open recovery** is also available on the startup error screen when the ledger cannot open. Import a valid Clarity ZIP there if the current vault has no usable snapshots. Conflicting interrupted saves are preserved and reported rather than overwritten.

**Export vault ZIP** creates an unencrypted, portable Clarity archive. **Import a Clarity backup ZIP** validates it and opens a preview; choosing a ZIP never immediately overwrites data. Only Clarity-generated archives with a supported manifest are accepted. Exports include Markdown, text, CSV/TSV, Obsidian canvas files, PDF, and PNG/JPEG/GIF/WebP/SVG attachments. Hidden files/folders (including `.obsidian` and `.backups`), symlinks, unsupported files, and Clarity’s separately stored API keys or connection credentials are excluded. Personal notes and attachments may still contain information you wrote into them, so handle exported ZIPs as private financial data.

Archive limits: 32 MB compressed, 64 MB expanded, 16 MB per file, and 1,000 files. Restore validates file hashes, paths, schema compatibility, relationships, and split totals. Related files use the recoverable save journal: an interrupted write is completed before the next read/save or on restart. If files were externally edited in conflict with that journal, recovery stops and preserves the versions for inspection. Close Obsidian and other file editors during restoration.

**Export CSV** offers all transactions or the dashboard’s current date/search/type/category filters. Split purchases and refunds produce one row per matching allocation. Columns are Transaction ID, Allocation ID, Date, Type, Merchant, Description, Account, Category, Amount, Net Spending, Original Total (first allocation only), Currency, Allocation Note, Location, and Reference. Amounts use major currency units. Net Spending is positive for expenses, negative for refunds, and zero for income/transfers. Sum Amount or Net Spending for allocation totals; Original Total repeats only once per transaction and still describes the whole purchase when exporting a subset of its categories. Formula-like text is escaped for spreadsheet safety. CSV does not contain the entire vault and cannot replace a recovery backup.

Desktop builds provide **Open backup folder** in Finder/File Explorer. Browser/server mode displays the folder path on the host. A same-drive backup protects against mistakes, not loss of the drive: copy ZIPs to a separate drive yourself when needed. No backup is uploaded automatically.

## OpenAI (optional)

Add your key in Settings to verify and save it. Desktop builds use operating-system encryption; browser/server mode uses a local `.env` file (owner-only file permissions). Disconnect removes the saved key value. You can also configure `OPENAI_API_KEY` in `.env`. The key is never saved to the Markdown vault or browser storage. The model dropdown shows compatible models returned by your API account. The app checks access when connecting a key and before categorization. AI actions are hidden without a connected key, an available selected model, or eligible uncategorized rows.

Categorization first uses your remembered merchant choices, then unambiguous reviewed history. The optional OpenAI action sends selected uncategorized descriptions, category labels, and up to 100 reviewed examples. It does not send balances or transaction amounts. API calls use structured output and `store: false`; suggestions remain marked for review. API billing applies. The rest of the app works offline with locally bundled fonts and assets.

## Accounting

Credit-card purchases count as spending; card repayments are transfers. Refunds reduce spending in their assigned category. Transfers are excluded from income and spending. Balance snapshots are independent of imported transactions: net worth uses the latest available balance for each account, subtracting credit-card and loan debt. Missing snapshots are flagged. Budgets are current monthly limits prorated for selected calendar days, not historical budget versions. Single-currency only; no currency conversion is performed.

## Verification

```sh
npm test
npm run build
```

Tests cover CSV parsing, date formats and locale month names, accounting, duplicate multiplicity, saved mappings, Markdown round trips, migration, save conflicts, and interrupted-save recovery.

## Categories, merchant learning, and themes

Manage categories on the dedicated **Categories** page. One level of subcategories is supported. A combined parent budget includes direct spending plus child spending; child targets sit inside it and are not added twice to the total plan. Separate mode gives the parent’s direct spending and each child independent limits. Selecting a parent in Transactions includes its children.

Choosing a category teaches the cleaned merchant name for future imports. Matching uncategorized rows in the same preview are filled immediately; existing manual choices remain intact. Editing a transaction can also fill matching uncategorized saved purchases. Remembered choices can be edited on Categories.

Merchant cleanup separates known city suffixes, explicit reference/store codes, and long numeric identifiers. Original statement text is always retained for inspection and duplicate detection. Brand digits such as 7-Eleven, 3M, and Forever 21 remain. This is heuristic: unknown locations and ambiguous merchant names cannot always be separated correctly. Edit the merchant, location, or reference on the transaction when necessary. No AI call is required for cleanup or learning.

Homepage shortcuts add expenses, income, refunds, transfers, accounts, balance snapshots, categories/subcategories, and budgets. Import remains available at the top. Settings offers eight themes, including dark options. The selected theme is saved in Settings.md.

### Budget creator and optional transaction fields

Use **Budget** on Overview or **Edit budgets** on Budgets to edit one category, select several, or select all. Each selected category gets its own monthly amount; group scopes retain combined-versus-separate behavior. Changes save together, and unselected limits stay unchanged.

Income and transfer entries have no category. Expenses and refunds require a category. Income, refunds, and transfers allow **No account**. These are empty cells in Transactions.md. Expenses still require an account. Older uncategorized refunds reduce total spending without reducing a specific category budget; transfers stay excluded. Balance snapshots and CSV statement imports still require an account.

Approved merchant matches autofill during manual entry, when the merchant name changes, and when opening an uncategorized transaction for review. Existing chosen categories, including an explicit No category, are preserved. All chart tooltip surfaces, hover highlights, axes, and main series now follow the selected theme.

## Monthly adjustments and Analysis

Open **Budgets → Adjust one month** to choose a month, category, temporary amount, and optional reason. One override per category/month replaces only that month’s amount. Your recurring category budget stays unchanged. Restore the usual limit from the same editor. Zero removes the limit for that month. Group scopes still come from the category’s combined/separate setting. Monthly, yearly, and custom-range totals include the overrides, prorated by calendar days; combined limits are not counted twice. Recurring budgets remain current-plan values, not historical versions.

**Analysis** offers six charts: monthly cash flow, category mix, budget trends, budget-versus-actual, top merchants, and daily spending. Trend windows can show six months, twelve months, or the selected date range. The category selector scopes budget, merchant, and daily views, including children when a parent is chosen. The global date selector controls merchant rankings, budget comparisons, and daily detail. Pin charts to move them to the top; hide them or restore them through Customize charts. These preferences persist in Markdown.

Merchant rankings show net spending after refunds. Transfers are excluded. The insights show average purchase size, largest merchant, over-budget targets, and category coverage. Missing statements and partial months can affect comparisons; charts never forecast unrecorded spending.

Mobile layouts include a dismissible navigation drawer, larger touch controls, stacked analysis charts, responsive dialogs, and transaction cards. Wide CSV previews remain horizontally scrollable.

## Statement and manual-entry improvements

Automatic date parsing uses valid, unambiguous numeric dates elsewhere in the same statement to resolve its date order. If the file contains conflicting orders, or only ambiguous dates, choose Day first or Month first explicitly. An inferred order is saved with the account import settings after import.

The import preview and Transactions page can assign a category to a whole merchant group while keeping every transaction separate. Amazon reference suffixes and Costco store numbers are separated from merchant names. Manual entry offers previously categorized names, adapts the name label to income and transfers, and places optional descriptions and other details below the essentials. On mobile, Add something expands the quick actions.

## Settings and local storage

Settings groups appearance/currency, AI connection/model, and storage/backups. Themes open in a popup. The currency dropdown includes all 178 current ISO 4217 currency and fund codes from [SIX List One](https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists/list-one.xml) (2026-09-17), with CAD, USD, and INR first. Currency remains locked when financial records exist; this app does not convert currencies.

Move vault accepts an absolute new or empty directory. It creates missing folders, copies and verifies the complete vault including personal notes and backups, persists VAULT_DIR in .env, switches future saves immediately, and removes the old copy. Close Obsidian before moving. Occupied destinations, nested paths, stale revisions, and unsupported symbolic links are rejected. If cleanup cannot complete, the app reports the remaining recovery copy. The original is retained until configuration commits. API requests are serialized during moves.

## Reinstalling and reopening your vault

Keep your vault folder when reinstalling Clarity. Replacing the application does not require a new vault. If local configuration remains, Clarity remembers the selected folder automatically.

If the folder location is no longer remembered:

1. On desktop first launch, choose **Use an existing vault**, or use **Open existing vault** on the setup guide’s **Your files** step.
2. You can also use **Settings → Storage & backups → Open existing vault**.
3. Choose the previous folder containing `Money.md` and your financial Markdown tables. Browser/server users enter a path on the host machine.
4. Click **Check folder**, review the saved profile, currency, and record counts, then **Open this vault**.

Clarity uses the existing folder in place. It does not move, merge, or replace it with the blank/new vault. Transactions, balances, categories, budgets, rules, saved views, notes, and vault preferences remain in that folder. Unfinished setup choices do not override the existing vault. The previously active folder is retained too; opening a vault is different from **Move vault**.

Unrelated/empty folders, malformed vaults, changed previews, and vaults open in another instance are rejected. Older supported vaults are backed up before their normal migration. A vault with an unfinished save must complete recovery first; the desktop startup chooser opens it through the normal recovery process. The OpenAI key is stored separately and may need reconnecting if application configuration was removed.

Deleting the actual vault folder deletes its files—reinstalling cannot recover deleted files without a backup. Keep the vault and a separate backup when cleaning up an installation.

## Transaction controls and personalisation

Transactions have visible Edit/Delete actions and selection checkboxes. Select all includes every result in the current date/search/category/type filters, including other pages. Changing filters clears selection. Deletion requires confirmation and the existing automatic backup retains the previous ledger. Editing includes description, date, amount, account, type, and category; changing imported details may affect future duplicate matching.

Settings includes a display name stored in Settings.md and eight themes. Move vault offers a native folder chooser (macOS Finder dialog, Windows folder browser, or Linux Zenity) plus a path field as a fallback. Choosing a folder does not move records until Move vault is clicked. Existing destination protections still apply.

## Desktop: macOS and Windows

Clarity bundles its own runtime, so installed desktop users do not need Node.js or a terminal. Open the Mac DMG and drag Clarity into Applications, or run the Windows installer. On first launch, create a new vault or choose an existing Markdown vault. Close the browser server first if opening its vault. Settings provides the native folder chooser for moving the vault later.

Desktop configuration lives in the operating system’s application-data directory. The default vault is inside that directory. OpenAI keys are encrypted using the operating system’s secure storage and kept outside the vault; reconnect your key when switching from the browser version. Browser/server mode continues to save keys in its private `.env` file. There is no automatic synchronization between installations.

To develop or build installers from source (Node.js 22+):

```sh
npm ci
npm run desktop
npm run desktop:mac
npm run desktop:windows
```

Installers appear in `release/`. Mac targets include Apple Silicon and Intel; Windows targets 64-bit PCs. Build on the destination operating system for release validation. The included GitHub workflow builds installers on macOS and Windows on every push to `main`, when manually started, or when a `v*` tag is pushed. After tests and all builds succeed, `main` builds update the rolling [Latest build](https://github.com/rajatmangal/Clarity/releases/tag/latest) prerelease. The README buttons use permanent filenames, so they keep downloading the newest successful main build without needing Actions access. Version tags publish separate versioned prereleases. Manual runs on `main` update the rolling release too; manual runs on other branches provide Actions artifacts only. Failed tests or builds keep the last published downloads available. Local builds are unsigned: public distribution still requires Apple signing/notarization and Windows signing credentials. Installed desktop builds offer update checks and notifications. Windows supports in-app download and restart-to-install; Mac automatic installation requires a Developer ID signed app, so unsigned Mac builds provide a download link. Use Settings → App updates to check manually or disable automatic checks. Older builds need one manual upgrade to obtain the updater. See the README’s Updates section for signing setup and release details.

The desktop browser is sandboxed, without Node access. Its private local service requires a per-launch secret. Packaged runtime preparation excludes `.env` files and vault records. A vault lock prevents two Clarity processes on the same computer from writing the same vault.

## Server: browser access from other devices

The same app can run as a single-user server. Copy `.env.example` to `.env` and configure:

```dotenv
CLARITY_HOST=0.0.0.0
PORT=4310
CLARITY_ORIGIN=https://money.example.com
CLARITY_PASSWORD=replace-with-a-long-unique-password
VAULT_DIR=/absolute/path/to/your/vault
```

Run `npm run build`, then `npm run start:server`. Put an HTTPS reverse proxy in front of the service, preserving the configured public Host header. Sign in with username `clarity` and the configured password. For local-network use, set the origin to the exact URL you will open. Basic authentication needs HTTPS on any untrusted network. This is a personal server, not a multi-user service.

Alternatively, set `CLARITY_PASSWORD` and `CLARITY_ORIGIN` in your environment and run `docker compose up --build -d`. The provided Compose file binds to localhost for use behind a reverse proxy and persists the vault/configuration in the `clarity-data` volume. Back up that volume. Server storage paths refer to the server; a client browser cannot select a server folder through Finder or Explorer.

Run `npm test` for unit tests. After `npm run desktop:prepare`, run `npm run test:integration` to verify authenticated server access, protected writes, and server storage behavior using a disposable vault.

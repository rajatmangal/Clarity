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

### Dates

Automatic parsing accepts named months (including `13 Oct 2026`, `October 13th, 2026`, `13Oct2026`), year-first dates, unambiguous numeric dates, common separators, compact `YYYYMMDD`, and dates with times or weekday prefixes. Select Day first / Month first / Year first for ambiguous numeric dates or compact dates such as `13102026`.

Month names support English, French, German, Spanish, Italian, Portuguese, and Dutch. Select the statement's language. Full/abbreviated names, case variations, and accents are recognized.

Two-digit years 00–68 mean 2000–2068; 69–99 mean 1969–1999. Yearless dates require an explicit statement year. For statements spanning December and January without years, add the years to the CSV or import the two years separately. Invalid dates never roll forward into another month.

Explicit modes cover Excel/Google Sheets serials (1900 system), Excel's 1904 system, Unix seconds, and Unix milliseconds. Serial 60 in the 1900 system is rejected because February 29, 1900 did not exist. Time fractions in spreadsheet dates are discarded. Date strings retain the printed calendar date; Unix timestamps use UTC.

Custom formats use strict, case-sensitive [Day.js parsing tokens](https://day.js.org/docs/en/parse/string-format), e.g. `DD MMM YYYY`, `MMM D, YYYY`, `DD/MM/YYYY HH:mm:ss`, or `YYYY年MM月DD日`. A year token is required. Use automatic mode for ISO timestamps with offsets. A live date preview shows conversions before import. No parser can infer every bank-specific convention safely; use the custom format or edit the CSV for unusual exports.

## Markdown storage

The default vault is `vault/`. Open it in Obsidian. Its tables are the source of truth:

- `Accounts.md`: account identities and types.
- `Transactions.md`: purchases, income, refunds, transfers, original descriptions, and separate merchant/location/reference fields.
- `Balances.md`: dated account balance snapshots.
- `Categories.md`: category labels, parents, colors, monthly budgets, and combined/separate budget mode.
- `ImportProfiles.md`: saved per-account CSV and date configuration.
- `Settings.md`: currency, model, and theme preferences.
- `MerchantRules.md`: remembered merchant-to-category choices.
- `BudgetOverrides.md`: category limits for individual months and their reasons.
- `ChartPreferences.md`: pinned and hidden Analysis charts.
- `Money.md`: an Obsidian index and your original notes.

Existing single-file ledgers migrate automatically. The original `Money.md` is backed up before migration. Records keep their IDs, and original notes remain in the index. Each table has a notes section preserved on saves. Preserve table headers, managed markers, and IDs when editing. Reload the dashboard after external edits; conflicting saves are rejected.

Amounts in Markdown use currency units with two decimals; calculations use integer cents. Import profile column indices are zero-based and the header row is one-based. Saved headers are a JSON array inside a Markdown table cell. A tab delimiter is escaped as `&#9;`.

A `.pending-save.md` journal makes interrupted multi-file writes recoverable. The app finishes a pending save on restart before reading records. If a pending write conflicts with a manual edit, it stops and preserves both versions for recovery. `.backups/` retains the latest 30 complete table snapshots plus the original migration backup. Files are local plaintext; back up or encrypt the vault as appropriate. Do not edit during a save or run multiple servers against the same vault.

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

Installers appear in `release/`. Mac targets include Apple Silicon and Intel; Windows targets 64-bit PCs. Build on the destination operating system for release validation. The included GitHub workflow builds installers on macOS and Windows on every push to `main`, when manually started, or when a `v*` tag is pushed. After tests and all builds succeed, `main` builds update the rolling [Latest build](https://github.com/rajatmangal/Clarity/releases/tag/latest) prerelease. The README buttons use permanent filenames, so they keep downloading the newest successful main build without needing Actions access. Version tags publish separate versioned prereleases. Manual runs on `main` update the rolling release too; manual runs on other branches provide Actions artifacts only. Failed tests or builds keep the last published downloads available. Local builds are unsigned: public distribution still requires Apple signing/notarization and Windows signing credentials. Updates are installed manually; there is no automatic updater yet.

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

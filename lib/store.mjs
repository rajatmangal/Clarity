// Legacy Markdown markers remain stable so existing vaults and notes stay readable.
import { currencyCodes } from "../public/currencies.js";
import { chartIds } from "../public/budget-plan.js";
import { upgradeState, themes } from "../public/money-model.js";
import {
  mkdir,
  readFile,
  writeFile,
  rename,
  readdir,
  unlink,
  rm,
} from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { dateModes, dateLocales } from "../public/dates.js";
import { defaultCategories, validDate, kinds } from "../public/core.js";
export const emptyState = () => ({
  currency: "CAD",
  theme: "lavender",
  displayName: "",
  onboardingCompleted: false,
  merchantRules: [],
  budgetOverrides: [],
  chartPreferences: [],
  model: "gpt-4.1-mini",
  categories: structuredClone(defaultCategories),
  accounts: [],
  transactions: [],
  balances: [],
  importProfiles: [],
});
export const schemas = {
  BudgetOverrides: ["id", "category", "month", "budget", "note"],
  ChartPreferences: ["id", "visibility", "position"],
  ImportProfiles: [
    "id",
    "account",
    "statement",
    "delimiter",
    "header",
    "date",
    "description",
    "amount",
    "debit",
    "credit",
    "dateFormat",
    "dateLocale",
    "customDateFormat",
    "statementYear",
    "layout",
    "sign",
    "decimal",
    "headers",
  ],
  Settings: [
    "currency",
    "model",
    "theme",
    "displayName",
    "onboardingCompleted",
  ],
  MerchantRules: ["id", "key", "merchant", "category"],
  Categories: ["id", "name", "color", "budget", "parentId", "budgetScope"],
  Accounts: ["id", "name", "type"],
  Balances: ["id", "account", "date", "amount"],
  Transactions: [
    "id",
    "date",
    "description",
    "amount",
    "kind",
    "category",
    "account",
    "review",
    "source",
    "merchant",
    "location",
    "reference",
  ],
};
const legacyHeaders = {
  Settings: ["currency", "model"],
  Categories: ["id", "name", "color", "budget"],
  Transactions: [
    "id",
    "date",
    "description",
    "amount",
    "kind",
    "category",
    "account",
    "review",
    "source",
  ],
};
const keys = {
  BudgetOverrides: "budgetOverrides",
  ChartPreferences: "chartPreferences",
  MerchantRules: "merchantRules",
  ImportProfiles: "importProfiles",
  Categories: "categories",
  Accounts: "accounts",
  Balances: "balances",
  Transactions: "transactions",
};
const esc = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/\t/g, "&#9;")
    .replace(/\|/g, "&#124;")
    .replace(/\r?\n/g, "&#10;");
const unesc = (v) =>
  v
    .replace(/&#9;/g, "\t")
    .replace(/&#10;/g, "\n")
    .replace(/&#124;/g, "|")
    .replace(/&amp;/g, "&");
export function serialize(
  state,
  notes = "\n## Notes\n\nYour notes live here. This section is preserved when you save in Clarity.\n",
) {
  state = upgradeState(state);
  let text =
    "# Money ledger\n\nOpen this file in Obsidian. Amounts and monthly budgets are in " +
    state.currency +
    ". Positive amounts; transaction kind controls their meaning. Credit/loan balances are amounts owed. Edit table cells, keep IDs and headers intact, then refresh Clarity.\n\n<!-- folio:start -->\n";
  for (const [section, columns] of Object.entries(schemas)) {
    const rows = section === "Settings" ? [state] : state[keys[section]] || [];
    text += `\n## ${section}\n\n| ${columns.join(" | ")} |\n| ${columns.map(() => "---").join(" | ")} |\n`;
    for (const row of rows)
      text +=
        "| " +
        columns
          .map((c) =>
            esc(
              ["amount", "budget"].includes(c) && section !== "ImportProfiles"
                ? (row[c] / 100).toFixed(2)
                : row[c],
            ),
          )
          .join(" | ") +
        " |\n";
  }
  return text + "\n<!-- folio:end -->\n" + notes;
}
export function deserialize(text) {
  const state = emptyState();
  if (
    !text.includes("<!-- folio:start -->") ||
    !text.includes("<!-- folio:end -->")
  )
    throw Error("Ledger markers are missing. Restore them or a backup.");
  const managed = text
    .split("<!-- folio:start -->")[1]
    .split("<!-- folio:end -->")[0];
  for (const [section, columns] of Object.entries(schemas)) {
    const content = managed.split(`## ${section}\n`)[1]?.split("\n## ")[0];
    if (
      !content &&
      [
        "ImportProfiles",
        "MerchantRules",
        "BudgetOverrides",
        "ChartPreferences",
      ].includes(section)
    )
      continue;
    if (!content) throw Error(`Missing ${section} section`);
    const lines = content.split("\n").filter((l) => l.startsWith("|"));
    const header = lines[0]
      ?.split("|")
      .slice(1, -1)
      .map((x) => x.trim());
    if (
      JSON.stringify(header) !== JSON.stringify(columns) &&
      JSON.stringify(header) !== JSON.stringify(legacyHeaders[section]) &&
      !(
        section === "Settings" &&
        [
          ["currency", "model", "theme"],
          ["currency", "model", "theme", "displayName"],
        ].some((columns) => JSON.stringify(header) === JSON.stringify(columns))
      )
    )
      throw Error(`Changed ${section} table headers`);
    const rows = lines.slice(2).map((line) => {
      const vals = line
        .split("|")
        .slice(1, -1)
        .map((v) => unesc(v.trim()));
      if (vals.length !== header.length)
        throw Error(`Invalid ${section} table row`);
      return Object.fromEntries(
        header.map((c, i) => {
          let v = vals[i];
          if (
            section === "ImportProfiles" &&
            [
              "header",
              "date",
              "description",
              "amount",
              "debit",
              "credit",
            ].includes(c)
          ) {
            if (!/^\d+$/.test(v))
              throw Error("Import column indices must be integers");
            v = Number(v);
          }
          if (
            ["amount", "budget"].includes(c) &&
            section !== "ImportProfiles"
          ) {
            if (!/^-?\d+\.\d{2}$/.test(v))
              throw Error("Amounts must have two decimal places");
            v = Math.round(Number(v) * 100);
          }
          if (c === "review" || c === "onboardingCompleted") {
            if (!["true", "false"].includes(v))
              throw Error(`${c} must be true or false`);
            v = v === "true";
          }
          return [c, v];
        }),
      );
    });
    if (section === "Settings") {
      if (rows.length !== 1) throw Error("Expected one settings row");
      Object.assign(state, rows[0]);
    } else state[keys[section]] = rows;
  }
  const upgraded = upgradeState(state);
  validate(upgraded);
  return upgraded;
}
export function validate(s) {
  const check = (ok, msg) => {
    if (!ok) throw Error(msg);
  };
  check(
    typeof (s.displayName ?? "") === "string" &&
      (s.displayName || "").length <= 80,
    "Display name must be 80 characters or fewer",
  );
  check(
    typeof (s.onboardingCompleted ?? false) === "boolean",
    "Invalid setup status",
  );
  check(currencyCodes.includes(s.currency), "Unsupported currency");
  check(
    typeof s.model === "string" && /^[a-zA-Z0-9._-]{1,80}$/.test(s.model),
    "Invalid model",
  );
  for (const key of ["categories", "accounts", "balances", "transactions"]) {
    check(Array.isArray(s[key]) && s[key].length <= 100000, `Invalid ${key}`);
    const ids = new Set();
    for (const r of s[key]) {
      check(
        typeof r.id === "string" && r.id.length <= 100 && !ids.has(r.id),
        `Invalid or duplicate ${key} ID`,
      );
      ids.add(r.id);
    }
  }
  check(
    themes.some((t) => t.id === (s.theme || "lavender")),
    "Invalid theme",
  );
  const categoryIds = new Set(s.categories.map((c) => c.id));
  check(
    Array.isArray(s.budgetOverrides || []) &&
      (s.budgetOverrides || []).length < 10000,
    "Invalid budget overrides",
  );
  const overrideKeys = new Set();
  for (const o of s.budgetOverrides || []) {
    check(
      categoryIds.has(o.category) &&
        /^\d{4}-(0[1-9]|1[0-2])$/.test(o.month) &&
        validDate(o.month + "-01"),
      "Invalid override category or month",
    );
    const key = o.category + ":" + o.month;
    check(
      o.id === key && !overrideKeys.has(key),
      "Duplicate or invalid monthly override",
    );
    overrideKeys.add(key);
    check(
      Number.isSafeInteger(o.budget) && o.budget >= 0 && o.budget < 1e12,
      "Invalid override budget",
    );
    check(
      typeof o.note === "string" && o.note.length <= 500,
      "Invalid override note",
    );
  }
  check(
    Array.isArray(s.chartPreferences || []) &&
      (s.chartPreferences || []).length <= chartIds.length,
    "Invalid chart preferences",
  );
  const chartKeys = new Set();
  for (const p of s.chartPreferences || []) {
    check(
      chartIds.includes(p.id) &&
        !chartKeys.has(p.id) &&
        ["shown", "hidden"].includes(p.visibility) &&
        ["pinned", "normal"].includes(p.position),
      "Invalid chart preference",
    );
    chartKeys.add(p.id);
  }

  for (const c of s.categories) {
    const parent = s.categories.find((p) => p.id === c.parentId);
    check(
      !c.parentId || (parent && !parent.parentId && parent.id !== c.id),
      "Subcategories must belong to a top-level category",
    );
    check(
      ["combined", "separate"].includes(c.budgetScope || "separate"),
      "Invalid budget mode",
    );
    check(
      c.id !== "uncategorized" || !c.parentId,
      "Uncategorized must remain a top-level category",
    );
  }
  const rules = s.merchantRules || [];
  check(
    Array.isArray(rules) && rules.length <= 100000,
    "Invalid merchant rules",
  );
  const ruleKeys = new Set();
  for (const r of rules) {
    check(
      typeof r.key === "string" &&
        r.key.length > 0 &&
        r.key.length <= 1000 &&
        r.id === r.key &&
        !ruleKeys.has(r.key) &&
        categoryIds.has(r.category) &&
        typeof r.merchant === "string" &&
        r.merchant.length > 0 &&
        r.merchant.length < 1000,
      "Invalid merchant rule",
    );
    ruleKeys.add(r.key);
  }
  const amount = (n) => Number.isSafeInteger(n) && Math.abs(n) < 1e14;
  for (const c of s.categories) {
    check(
      typeof c.name === "string" &&
        c.name.trim().length > 0 &&
        c.name.length < 100,
      "Invalid category name",
    );
    check(/^#[0-9a-f]{6}$/i.test(c.color), "Invalid category color");
    check(amount(c.budget) && c.budget >= 0, "Invalid budget");
  }
  check(
    s.categories.some((c) => c.id === "uncategorized"),
    "Uncategorized category is required",
  );
  check(
    new Set(
      s.categories.map((c) => (c.parentId || "") + ":" + c.name.toLowerCase()),
    ).size === s.categories.length,
    "Category names must be unique within their parent",
  );
  for (const a of s.accounts)
    check(
      typeof a.name === "string" &&
        a.name.trim() &&
        a.name.length < 100 &&
        ["bank", "savings", "credit", "investment", "loan", "cash"].includes(
          a.type,
        ),
      "Invalid account",
    );
  for (const t of s.transactions) {
    for (const k of ["merchant", "location", "reference"])
      check(
        t[k] === undefined || (typeof t[k] === "string" && t[k].length < 1000),
        "Invalid transaction details",
      );
    check(validDate(t.date), "Invalid transaction date");
    check(
      typeof t.description === "string" &&
        (t.description.trim() ||
          (typeof t.merchant === "string" && t.merchant.trim())) &&
        t.description.length < 1000,
      "Invalid description",
    );
    check(
      amount(t.amount) && t.amount > 0,
      "Transaction amount must be positive",
    );
    check(kinds.includes(t.kind), "Invalid transaction kind");
    check(
      (t.category === "" && t.kind !== "expense") ||
        s.categories.some((c) => c.id === t.category),
      "Unknown category",
    );
    check(
      (t.account === "" && t.kind !== "expense") ||
        s.accounts.some((a) => a.id === t.account),
      "Unknown account",
    );
    check(typeof t.review === "boolean", "Invalid review flag");
    check(
      typeof t.source === "string" && t.source.length < 100,
      "Invalid source",
    );
  }
  const seen = new Set();
  for (const b of s.balances) {
    check(
      validDate(b.date) &&
        amount(b.amount) &&
        s.accounts.some((a) => a.id === b.account),
      "Invalid balance",
    );
    let key = b.account + b.date;
    check(!seen.has(key), "Only one balance per account per date");
    seen.add(key);
  }
  const profiles = s.importProfiles || [];
  check(Array.isArray(profiles), "Invalid import profiles");
  const profileAccounts = new Set();
  for (const p of profiles) {
    check(
      s.accounts.some((a) => a.id === p.account) &&
        p.id === p.account &&
        !profileAccounts.has(p.account),
      "Invalid or duplicate import profile account",
    );
    profileAccounts.add(p.account);
    check(
      ["bank", "credit"].includes(p.statement) &&
        [",", ";", "\t"].includes(p.delimiter),
      "Invalid statement format",
    );
    check(
      Number.isInteger(p.header) && p.header >= 1 && p.header <= 100000,
      "Invalid header row",
    );
    for (const k of ["date", "description", "amount", "debit", "credit"])
      check(
        Number.isInteger(p[k]) && p[k] >= 0 && p[k] < 10000,
        "Invalid column mapping",
      );
    check(
      dateModes.some(([v]) => v === p.dateFormat) &&
        dateLocales.some(([v]) => v === p.dateLocale),
      "Invalid date format or language",
    );
    check(
      typeof p.customDateFormat === "string" &&
        p.customDateFormat.length <= 200,
      "Invalid custom format",
    );
    check(
      p.statementYear === "" || /^\d{4}$/.test(String(p.statementYear)),
      "Invalid statement year",
    );
    check(
      ["single", "split"].includes(p.layout) &&
        ["negative-expense", "positive-expense"].includes(p.sign) &&
        [".", ","].includes(p.decimal),
      "Invalid amount mapping",
    );
    let headers;
    try {
      headers = JSON.parse(p.headers);
    } catch {
      throw Error("Invalid saved headers");
      const fields = [
        "date",
        "description",
        ...(p.layout === "split" ? ["debit", "credit"] : ["amount"]),
      ];
      check(
        fields.every((k) => p[k] < headers.length) &&
          new Set(fields.map((k) => p[k])).size === fields.length,
        "Choose distinct valid columns for the import profile",
      );
      check(
        (s.accounts.find((a) => a.id === p.account).type === "credit") ===
          (p.statement === "credit"),
        "Statement type must match its account",
      );
      if (p.dateFormat === "CUSTOM")
        check(
          /Y{2,4}/.test(p.customDateFormat),
          "Custom date format must include a year",
        );
    }
    check(
      Array.isArray(headers) &&
        headers.length <= 10000 &&
        headers.every((h) => typeof h === "string" && h.length < 1000),
      "Invalid saved headers",
    );
    const fields = [
      "date",
      "description",
      ...(p.layout === "split" ? ["debit", "credit"] : ["amount"]),
    ];
    check(
      fields.every((k) => p[k] < headers.length) &&
        new Set(fields.map((k) => p[k])).size === fields.length,
      "Choose distinct valid columns for the import profile",
    );
    check(
      (s.accounts.find((a) => a.id === p.account).type === "credit") ===
        (p.statement === "credit"),
      "Statement type must match its account",
    );
    if (p.dateFormat === "CUSTOM")
      check(
        /Y{2,4}/.test(p.customDateFormat),
        "Custom date format must include a year",
      );
  }
  return s;
}
const revision = (text) => createHash("sha256").update(text).digest("hex");
const notesOf = (raw) =>
  raw?.split("<!-- folio:end -->")[1] || "\n## Notes\n\n";
const sectionOf = (raw, section) =>
  raw
    .split(`## ${section}\n`)[1]
    ?.split("\n## ")[0]
    ?.split("<!-- folio:end -->")[0];
const filenames = Object.keys(schemas).map((s) => s + ".md");
function splitFiles(state, old = {}) {
  const all = serialize(state);
  return Object.fromEntries(
    Object.keys(schemas).map((section) => [
      section + ".md",
      `# ${section}\n\nAmounts are in ${state.currency}. Keep IDs and table headers intact.\n\n<!-- folio:start -->\n\n## ${section}\n${sectionOf(all, section)}\n<!-- folio:end -->\n${notesOf(old[section + ".md"])}`,
    ]),
  );
}
function joinFiles(files) {
  return (
    "# Money ledger\n<!-- folio:start -->\n" +
    Object.keys(schemas)
      .map((section) => {
        const raw = files[section + ".md"];
        if (
          !raw &&
          ["MerchantRules", "BudgetOverrides", "ChartPreferences"].includes(
            section,
          )
        )
          return "";
        if (!raw?.includes("<!-- folio:end -->"))
          throw Error(`Missing or malformed ${section}.md`);
        return `\n## ${section}\n${sectionOf(raw, section)}`;
      })
      .join("") +
    "\n<!-- folio:end -->\n"
  );
}
export class Store {
  constructor(dir) {
    this.dir = dir;
    this.file = path.join(dir, "Money.md");
    this.queue = Promise.resolve();
  }
  async atomic(name, raw) {
    const dest = path.join(this.dir, name),
      tmp = dest + "." + randomUUID() + ".tmp";
    await writeFile(tmp, raw, { mode: 0o600 });
    await rename(tmp, dest);
  }
  async optional(name) {
    try {
      return await readFile(path.join(this.dir, name), "utf8");
    } catch (e) {
      if (e.code === "ENOENT") return null;
      throw e;
    }
  }
  async recover() {
    const pending = await this.optional(".pending-save.md");
    if (!pending) return;
    const journal = JSON.parse(pending.split("```json\n")[1].split("\n```")[0]);
    for (const [name, next] of Object.entries(journal.next)) {
      if (![...filenames, "Money.md"].includes(name))
        throw Error("Invalid pending save filename");
      const current = await this.optional(name);
      if (current !== next && current !== journal.old[name])
        throw Error(
          `Pending save conflicts with an external edit to ${name}. Both copies are preserved in .pending-save.md.`,
        );
    }
    for (const [name, next] of Object.entries(journal.next)) {
      if ((await this.optional(name)) !== next) await this.atomic(name, next);
    }
    await unlink(path.join(this.dir, ".pending-save.md"));
  }
  async commitFiles(next, old) {
    await this.atomic(
      ".pending-save.md",
      "# Pending recoverable save\n\n```json\n" +
        JSON.stringify({ old, next }) +
        "\n```\n",
    );
    await this.recover();
  }
  async init() {
    await mkdir(this.dir, { recursive: true });
    await this.recover();
    if (await this.optional("Settings.md")) {
      const settings = await this.optional("Settings.md");
      const categories = await this.optional("Categories.md");
      const transactions = await this.optional("Transactions.md");
      if (
        !(await this.optional("MerchantRules.md")) ||
        !(await this.optional("BudgetOverrides.md")) ||
        !(await this.optional("ChartPreferences.md")) ||
        !settings.includes("| theme |") ||
        !settings.includes("| displayName |") ||
        !settings.includes("| onboardingCompleted |") ||
        !categories?.includes("| parentId |") ||
        !transactions?.includes("| merchant |")
      ) {
        const old = await this.snapshot(true);
        const backup = path.join(this.dir, ".backups", "upgrade-" + Date.now());
        await mkdir(backup, { recursive: true });
        for (const [name, raw] of Object.entries(old.files))
          if (raw !== null)
            await writeFile(path.join(backup, name), raw, { mode: 0o600 });
        const next = splitFiles(old.state, old.files);
        const index = await this.optional("Money.md");
        if (index) {
          const missing = [
            "MerchantRules",
            "BudgetOverrides",
            "ChartPreferences",
          ].filter((name) => !index.includes(`[[${name}]]`));
          if (missing.length) {
            old.files["Money.md"] = index;
            next["Money.md"] =
              index +
              "\n" +
              missing.map((name) => `- [[${name}]]`).join("\n") +
              "\n";
          }
        }
        await this.commitFiles(next, old.files);
      }
      return;
    }
    const legacy = await this.optional("Money.md");
    const state = legacy ? deserialize(legacy) : emptyState();
    if (legacy) {
      await mkdir(path.join(this.dir, ".backups"), { recursive: true });
      await writeFile(
        path.join(this.dir, ".backups", "legacy-" + Date.now() + ".md"),
        legacy,
        { mode: 0o600 },
      );
    }
    const next = splitFiles(state);
    next["Money.md"] =
      "# My money journal\n\nYour records are stored in separate Markdown tables:\n\n" +
      Object.keys(schemas)
        .map((k) => `- [[${k}]]`)
        .join("\n") +
      "\n\n" +
      (legacy ? notesOf(legacy) : "## Notes\n\n");
    const old = {};
    for (const name of Object.keys(next)) {
      old[name] = await this.optional(name);
      if (name !== "Money.md" && old[name] !== null)
        throw Error(
          `Cannot migrate: ${name} already exists. Existing files have not been overwritten.`,
        );
    }
    await this.commitFiles(next, old);
  }
  async snapshot(allowLegacy = false) {
    await this.recover();
    const files = {};
    for (const name of filenames) {
      const raw = await this.optional(name);
      if (
        raw === null &&
        (!allowLegacy ||
          ![
            "MerchantRules.md",
            "BudgetOverrides.md",
            "ChartPreferences.md",
          ].includes(name))
      )
        throw Error(`Missing ${name}. Restore it from a vault backup.`);
      files[name] = raw;
    }
    const raw = joinFiles(files);
    return {
      state: deserialize(raw),
      revision: revision(JSON.stringify(files)),
      raw,
      files,
    };
  }
  read() {
    return this.queue.then(() => this.snapshot());
  }
  save(state, expected) {
    const run = this.queue.then(async () => {
      state = upgradeState(state);
      validate(state);
      const old = await this.snapshot();
      if (old.revision !== expected) {
        const e = Error(
          "The vault changed in another tab or Obsidian. Refresh before saving.",
        );
        e.status = 409;
        throw e;
      }
      const backupRoot = path.join(this.dir, ".backups");
      const backup = path.join(backupRoot, `${Date.now()}-${randomUUID()}`);
      await mkdir(backup, { recursive: true });
      for (const [name, raw] of Object.entries(old.files))
        if (raw !== null)
          await writeFile(path.join(backup, name), raw, { mode: 0o600 });
      const next = splitFiles(state, old.files);
      const current = await this.snapshot();
      if (current.revision !== expected) {
        const e = Error("The vault changed while saving. Refresh first.");
        e.status = 409;
        throw e;
      }
      await this.commitFiles(next, old.files);
      const dirs = (await readdir(backupRoot, { withFileTypes: true }))
        .filter((f) => f.isDirectory() && /^\d+-/.test(f.name))
        .map((f) => f.name)
        .sort();
      for (const name of dirs.slice(0, -30))
        await rm(path.join(backupRoot, name), { recursive: true });
      const saved = await this.snapshot();
      return { state: saved.state, revision: saved.revision };
    });
    this.queue = run.catch(() => {});
    return run;
  }
}

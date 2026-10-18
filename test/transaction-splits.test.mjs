import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  readFile,
  writeFile,
  unlink,
  rm,
  readdir,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  emptyState,
  serialize,
  deserialize,
  validate,
  Store,
} from "../lib/store.mjs";
import {
  summarize,
  needsReview,
  normalizeCSV,
  parseCSV,
} from "../public/core.js";
import { analysisData } from "../public/analysis.js";
import {
  rememberCategory,
  applyMerchantLearning,
} from "../public/money-model.js";
import {
  merchantGroups,
  applyGroupCategory,
} from "../public/merchant-groups.js";
import { removeAccount, removeCategory } from "../public/record-management.js";
import {
  recordImport,
  undoImport,
  undoPreview,
  coverageStatus,
} from "../public/statement-history.js";
import {
  categoryTransactions,
  categoryAmount,
  deleteTransactions,
  setTransactionSplits,
  draftSplits,
  percentageAmounts,
  parseSplitValue,
  splitBalance,
} from "../public/transaction-splits.js";

const purchase = {
  id: "p",
  date: "2026-09-10",
  amount: 15000,
  kind: "expense",
  category: "",
  merchant: "Costco",
  description: "COSTCO ORIGINAL",
  location: "",
  reference: "",
  account: "a",
  source: "reviewed",
  review: false,
};
const base = () => ({
  ...emptyState(),
  accounts: [{ id: "a", name: "Bank", type: "bank" }],
  transactions: [{ ...purchase }],
});
const rows = () => [
  {
    id: "s1",
    transaction: "p",
    category: "groceries",
    amount: 10000,
    note: "Food | fruit\nWeekly",
  },
  {
    id: "s2",
    transaction: "p",
    category: "shopping",
    amount: 5000,
    note: "Household",
  },
];
const splitState = () => ({ ...base(), transactionSplits: rows() });
const range = ["2026-09-01", "2026-09-30"];

test("live amount balance identifies exact over-allocation without changing entered values", () => {
  const rows = [{ value: "100.00" }, { value: "60.00" }];
  assert.deepEqual(splitBalance(15000, rows), {
    allocated: 16000,
    remaining: -1000,
    over: true,
  });
  assert.equal(rows[1].value, "60.00");
  assert.equal(
    splitBalance(15000, [{ value: "100" }, { value: "50" }]).over,
    false,
  );
  assert.equal(
    splitBalance(15000, [{ value: "100" }, { value: "40" }]).remaining,
    1000,
  );
});
test("live percentage balance caps allocation at exactly 100 percent", () => {
  assert.deepEqual(
    splitBalance(15000, [{ value: "75" }, { value: "30" }], "percent"),
    { allocated: 10500, remaining: -500, over: true },
  );
  assert.equal(
    splitBalance(15000, [{ value: "66.67" }, { value: "33.33" }], "percent")
      .over,
    false,
  );
});

test("split allocations round-trip while the statement record stays intact", () => {
  const s = splitState();
  validate(s);
  assert.deepEqual(deserialize(serialize(s)), s);
  assert.equal(s.transactions.length, 1);
  assert.equal(s.transactions[0].description, "COSTCO ORIGINAL");
  assert.equal(categoryTransactions(s).length, 2);
});
test("budgets attribute allocations without double-counting purchases or refunds", () => {
  const s = splitState();
  s.transactions.push({
    ...purchase,
    id: "r",
    kind: "refund",
    amount: 3000,
    account: "",
  });
  s.transactionSplits.push(
    { ...rows()[0], id: "r1", transaction: "r", amount: 2000 },
    { ...rows()[1], id: "r2", transaction: "r", amount: 1000 },
  );
  validate(s);
  const summary = summarize(s, ...range);
  assert.equal(summary.tx.length, 2);
  assert.equal(summary.spending, 12000);
  assert.equal(summary.refunds, 3000);
  assert.equal(
    summary.categories.find((c) => c.id === "groceries").spent,
    8000,
  );
  assert.equal(summary.categories.find((c) => c.id === "shopping").spent, 4000);
  const all = analysisData(s, ...range, range[0]);
  assert.equal(all.net, 12000);
  assert.equal(all.records, 2);
  assert.equal(all.purchases, 1);
  assert.equal(all.average, 15000);
  assert.equal(all.merchants[0].Spending, 120);
  assert.equal(all.merchants[0].purchases, 1);
  assert.equal(all.months[0].records, 2);
  assert.equal(all.months[0].Spending, 120);
  const selected = analysisData(s, ...range, range[0], "groceries");
  assert.equal(selected.net, 8000);
  assert.equal(selected.purchases, 1);
  assert.equal(selected.average, 10000);
  assert.equal(selected.merchants[0].Spending, 80);
  assert.equal(selected.months[0].Selected, 80);
});
test("combined parent budgets roll child allocations up once", () => {
  const s = splitState();
  s.categories = s.categories.map((c) =>
    c.id === "groceries"
      ? { ...c, parentId: "shopping" }
      : c.id === "shopping"
        ? { ...c, budgetScope: "combined", budget: 20000 }
        : c,
  );
  const summary = summarize(s, ...range);
  assert.equal(
    summary.categories.find((c) => c.id === "shopping").budgetSpent,
    15000,
  );
  const data = analysisData(s, ...range, range[0], "shopping");
  assert.equal(data.net, 15000);
  assert.equal(data.budgets[0].Spending, 150);
});
test("category filtering returns only the matching part of a purchase", () => {
  const s = splitState();
  assert.equal(categoryAmount(s, purchase, new Set(["groceries"])), 10000);
  assert.equal(
    categoryAmount(s, purchase, new Set(["groceries", "shopping"])),
    15000,
  );
  assert.equal(categoryAmount(s, purchase, new Set([""])), 0);
});
test("allocation validation rejects mismatch, zero, orphans, duplicate IDs, unsupported types and one row", () => {
  const s = splitState();
  for (const transactionSplits of [
    [rows()[0]],
    [...rows(), rows()[0]],
    [{ ...rows()[0], amount: 0 }, rows()[1]],
    [{ ...rows()[0], amount: 9999 }, rows()[1]],
    [{ ...rows()[0], transaction: "missing" }, rows()[1]],
    [{ ...rows()[0], category: "missing" }, rows()[1]],
  ])
    assert.throws(() => validate({ ...s, transactionSplits }));
  for (const kind of ["income", "transfer"])
    assert.throws(
      () => validate({ ...s, transactions: [{ ...purchase, kind }] }),
      /purchase or refund/,
    );
  assert.throws(
    () =>
      validate({
        ...s,
        transactions: [{ ...purchase, category: "groceries" }],
      }),
    /parent category/,
  );
});
test("exact decimal and percentage entry resolve to integer cents", () => {
  assert.equal(parseSplitValue("10.01"), 1001);
  for (const v of ["", "1e2", "-2", "0", "1.001", "NaN"])
    assert.throws(() => parseSplitValue(v));
  assert.deepEqual(percentageAmounts(1001, [5000, 5000]), [501, 500]);
  assert.deepEqual(percentageAmounts(101, [3333, 3333, 3334]), [34, 33, 34]);
  assert.deepEqual(
    percentageAmounts(999999999999, [5000, 5000]),
    [500000000000, 499999999999],
  );
  assert.throws(() => percentageAmounts(1, [5000, 5000]), /at least one cent/);
  assert.throws(() => percentageAmounts(100, [3333, 3333, 3333]), /100%/);
  const draft = rows().map((r) => ({ ...r, value: "50.00" }));
  assert.deepEqual(
    draftSplits(1001, draft, "percent", base().categories).map((r) => r.amount),
    [501, 500],
  );
  assert.throws(
    () =>
      draftSplits(
        1001,
        [{ ...draft[0], category: "" }, draft[1]],
        "percent",
        base().categories,
      ),
    /every allocation/,
  );
  assert.throws(
    () => draftSplits(1001, draft, "amount", base().categories),
    /original transaction total/,
  );
});
test("merchant learning and grouped edits protect split allocations", () => {
  const s = splitState();
  assert.equal(rememberCategory(s, { ...purchase, category: "shopping" }), s);
  assert.deepEqual(merchantGroups(s.transactions, s), []);
  assert.equal(
    applyGroupCategory(s.transactions, "costco", "dining", s)[0].category,
    "",
  );
  assert.equal(applyMerchantLearning(s.transactions, s)[0].category, "");
});
test("single, bulk, and account deletion clean up allocations; moving an account preserves them", () => {
  const s = splitState();
  assert.equal(deleteTransactions(s, ["p"]).transactionSplits.length, 0);
  assert.equal(deleteTransactions(s, []).transactionSplits.length, 2);
  assert.equal(
    removeAccount(s, "a", { deleteRecords: true }).transactionSplits.length,
    0,
  );
  s.accounts.push({ id: "b", name: "Other", type: "bank" });
  const moved = removeAccount(s, "a", { destination: "b" });
  validate(moved);
  assert.equal(moved.transactionSplits.length, 2);
  assert.equal(moved.transactions[0].account, "b");
});
test("category deletion reassigns allocations, including explicit review for Uncategorized", () => {
  const s = splitState();
  const moved = removeCategory(s, "groceries", "dining");
  validate(moved);
  assert.equal(moved.transactionSplits[0].category, "dining");
  const missing = removeCategory(s, "groceries");
  validate(missing);
  assert.equal(needsReview(missing.transactions[0], missing), true);
  assert.equal(summarize(missing, ...range).review, 1);
});
test("removing a split leaves one category and one original transaction", () => {
  const next = setTransactionSplits(splitState(), "p", []);
  next.transactions[0] = { ...next.transactions[0], category: "groceries" };
  validate(next);
  assert.equal(
    summarize(next, ...range).categories.find((c) => c.id === "groceries")
      .spent,
    15000,
  );
});
test("import duplicate detection still uses the parent, not allocation rows", () => {
  const s = splitState();
  const parsed = normalizeCSV(
    parseCSV("Date,Description,Amount\n2026-09-10,COSTCO ORIGINAL,-150.00"),
    {
      start: 1,
      date: 0,
      description: 1,
      amount: 2,
      dateFormat: "YMD",
      layout: "single",
      sign: "negative-expense",
      decimal: ".",
    },
    s.accounts[0],
    s.transactions,
  );
  assert.equal(parsed.transactions[0].duplicate, true);
});
test("a later split is protected by undo even if the parent snapshot is unchanged", () => {
  const s = base();
  s.transactions = [];
  const imported = recordImport(s, {
    batch: {
      id: "batch",
      account: "a",
      accountName: "Bank",
      filename: "test.csv",
      hash: "b".repeat(64),
      createdAt: "2026-10-17T00:00:00Z",
      start: range[0],
      end: range[1],
      duplicates: 0,
      invalid: 0,
      skipped: 0,
      warnings: "",
    },
    transactions: [{ ...purchase, kind: "refund" }],
    complete: true,
  });
  const withSplits = setTransactionSplits(imported, "p", rows());
  validate(withSplits);
  assert.equal(
    coverageStatus(withSplits, withSplits.statementCoverage[0]),
    "confirmed",
  );
  assert.equal(undoPreview(withSplits, "batch").edited.length, 1);
  const kept = undoImport(withSplits, "batch");
  validate(kept);
  assert.equal(kept.transactionSplits.length, 2);
  const removed = undoImport(withSplits, "batch", { removeEdited: true });
  validate(removed);
  assert.equal(removed.transactionSplits.length, 0);
});
test("old vaults receive a backed-up split file migration; missing migrated files fail safely", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "clarity-splits-"));
  try {
    const store = new Store(dir);
    await store.init();
    const initial = await store.read();
    await store.save(
      { ...base(), transactions: [{ ...purchase, category: "groceries" }] },
      initial.revision,
    );
    await unlink(path.join(dir, "TransactionSplits.md"));
    await writeFile(
      path.join(dir, "Money.md"),
      (await readFile(path.join(dir, "Money.md"), "utf8")).replace(
        "- [[TransactionSplits]]",
        "",
      ),
    );
    const migrated = new Store(dir);
    await migrated.init();
    let current = await migrated.read();
    assert.equal(current.state.transactions.length, 1);
    assert.deepEqual(current.state.transactionSplits, []);
    assert.ok(
      (await readdir(path.join(dir, ".backups"))).some((f) =>
        f.startsWith("upgrade-"),
      ),
    );
    current = await migrated.save(splitState(), current.revision);
    const reopened = new Store(dir);
    await reopened.init();
    assert.equal((await reopened.read()).state.transactionSplits.length, 2);
    await unlink(path.join(dir, "TransactionSplits.md"));
    await assert.rejects(
      new Store(dir).init(),
      /TransactionSplits.md is missing/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

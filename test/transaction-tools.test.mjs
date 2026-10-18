import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  readFile,
  writeFile,
  unlink,
  readdir,
  rm,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  emptyState,
  Store,
  serialize,
  deserialize,
  validate,
} from "../lib/store.mjs";
import {
  bulkEditPlan,
  matchesTransaction,
  viewFilters,
  putSavedView,
  validateSavedView,
} from "../public/transaction-tools.js";
import { needsReview } from "../public/core.js";
import { Backups } from "../lib/backups.mjs";

const tx = (id, kind, category, account = "a") => ({
  id,
  kind,
  category,
  account,
  date: "2026-10-18",
  amount: 1000,
  merchant: id,
  description: "Original " + id,
  location: "",
  reference: "",
  review: true,
  source: "import",
});
const base = () => ({
  ...emptyState(),
  accounts: [
    { id: "a", name: "Chequing", type: "bank" },
    { id: "b", name: "Credit card", type: "credit" },
  ],
  transactions: [
    tx("purchase", "expense", "groceries"),
    tx("refund", "refund", "shopping", "b"),
    tx("income", "income", "", ""),
    tx("split", "expense", "", "b"),
  ],
  transactionSplits: [
    {
      id: "s1",
      transaction: "split",
      category: "groceries",
      amount: 400,
      note: "Food",
    },
    {
      id: "s2",
      transaction: "split",
      category: "shopping",
      amount: 600,
      note: "Home",
    },
  ],
});
const view = (extra = {}) => ({
  id: "v",
  name: "Groceries",
  search: "",
  type: "all",
  category: "groceries",
  account: "all",
  dateMode: "current",
  start: "",
  end: "",
  ...extra,
});

test("bulk changes only chosen records/fields, with mixed account/category values and unchanged financial totals", () => {
  const state = base(),
    original = structuredClone(state);
  const plan = bulkEditPlan(state, ["purchase", "refund"], {
    category: "dining",
    account: "b",
    review: "reviewed",
  });
  assert.equal(plan.changes.length, 2);
  assert.equal(plan.next.transactions[0].category, "dining");
  assert.equal(plan.next.transactions[0].account, "b");
  assert.equal(needsReview(plan.next.transactions[0], plan.next), false);
  assert.deepEqual(plan.next.transactions[2], state.transactions[2]);
  assert.deepEqual(plan.next.transactionSplits, state.transactionSplits);
  assert.deepEqual(state, original);
  validate(plan.next);
  assert.deepEqual(
    plan.next.transactions.map((t) => [
      t.id,
      t.amount,
      t.date,
      t.description,
      t.merchant,
      t.kind,
    ]),
    state.transactions.map((t) => [
      t.id,
      t.amount,
      t.date,
      t.description,
      t.merchant,
      t.kind,
    ]),
  );
  assert.deepEqual(plan.next.merchantRules, state.merchantRules);
});

test("category edits skip income/transfers and leave split allocations intact by default", () => {
  const state = base();
  const plan = bulkEditPlan(
    state,
    state.transactions.map((t) => t.id),
    { category: "dining" },
  );
  assert.equal(plan.skippedCategories, 2);
  assert.equal(plan.splitCount, 1);
  assert.equal(plan.changes.length, 2);
  assert.deepEqual(plan.next.transactionSplits, state.transactionSplits);
  assert.equal(plan.next.transactions[2].category, "");
  validate(plan.next);
});

test("explicit split category edits preserve allocation amounts, IDs, notes and parent identity", () => {
  const state = base(),
    plan = bulkEditPlan(state, ["split"], {
      category: "dining",
      includeSplits: true,
    });
  assert.equal(plan.allocationChanges, 2);
  assert.equal(plan.changes[0].fields[0].name, "Allocation categories");
  assert.equal(plan.next.transactions[3].category, "");
  assert.deepEqual(
    plan.next.transactionSplits.map(({ category, ...rest }) => rest),
    state.transactionSplits.map(({ category, ...rest }) => rest),
  );
  assert.ok(plan.next.transactionSplits.every((s) => s.category === "dining"));
  validate(plan.next);
});

test("bulk rejects invalid or stale selections without modifying any records", () => {
  const state = base(),
    original = structuredClone(state);
  for (const ids of [[], ["missing"], ["purchase", "purchase"]])
    assert.throws(
      () => bulkEditPlan(state, ids, { account: "b" }),
      /Select|selection/,
    );
  assert.throws(
    () => bulkEditPlan(state, ["purchase"], { account: "" }),
    /Expenses need an account/,
  );
  assert.throws(
    () => bulkEditPlan(state, ["purchase"], { category: "deleted" }),
    /existing category/,
  );
  assert.throws(
    () => bulkEditPlan(state, ["purchase"], { account: "deleted" }),
    /existing account/,
  );
  assert.throws(
    () => bulkEditPlan(state, ["purchase"], { amount: 0 }),
    /Unsupported/,
  );
  assert.throws(
    () => bulkEditPlan(state, ["purchase"], {}),
    /at least one field/,
  );
  assert.deepEqual(state, original);
});

test("review state can be changed both ways for manually reviewed records; invalid split approvals are blocked", () => {
  let state = base();
  state.transactions[0] = {
    ...state.transactions[0],
    source: "reviewed",
    review: false,
  };
  const plan = bulkEditPlan(state, ["purchase"], { review: "needs-review" });
  assert.equal(needsReview(plan.next.transactions[0], plan.next), true);
  state.transactionSplits[0].category = "uncategorized";
  assert.throws(
    () => bulkEditPlan(state, ["split"], { review: "reviewed" }),
    /every split allocation/,
  );
  const fixed = bulkEditPlan(state, ["split"], {
    category: "dining",
    includeSplits: true,
    review: "reviewed",
  });
  assert.equal(needsReview(fixed.next.transactions[3], fixed.next), false);
  const noChange = bulkEditPlan(fixed.next, ["split"], {
    category: "dining",
    includeSplits: true,
    review: "reviewed",
  });
  assert.equal(noChange.changes.length, 0);
});

test("account can be removed for refunds, income and transfers without changing kind or amounts", () => {
  const state = base();
  state.transactions.push(tx("transfer", "transfer", "", "a"));
  const result = bulkEditPlan(state, ["refund", "income", "transfer"], {
    account: "",
  });
  assert.ok(
    result.next.transactions
      .filter((t) => ["refund", "income", "transfer"].includes(t.id))
      .every((t) => t.account === ""),
  );
  validate(result.next);
});

test("saved filters match parent purchases through individual split categories and allocation text", () => {
  const state = base();
  assert.equal(
    matchesTransaction(state, state.transactions[3], {
      category: "groceries",
      search: "Food",
      account: "b",
    }),
    true,
  );
  assert.equal(
    matchesTransaction(state, state.transactions[3], { category: "dining" }),
    false,
  );
  assert.equal(
    matchesTransaction(state, state.transactions[2], {
      account: "",
      category: "",
    }),
    true,
  );
  assert.equal(
    matchesTransaction(state, state.transactions[0], {
      search: "Chequing",
      type: "review",
    }),
    true,
  );
  assert.equal(
    matchesTransaction(state, state.transactions[0], { type: "reviewed" }),
    false,
  );
  assert.equal(
    matchesTransaction(state, state.transactions[0], { category: "deleted" }),
    false,
  );
  assert.equal(
    matchesTransaction(state, state.transactions[0], { account: "deleted" }),
    false,
  );
});

test("saved view rolling month/year dates resolve correctly including leap years; current range stays selected", () => {
  assert.equal(
    viewFilters(view({ dateMode: "month" }), "2028-02-12").end,
    "2028-02-29",
  );
  assert.equal(
    viewFilters(view({ dateMode: "month" }), "2027-02-12").end,
    "2027-02-28",
  );
  assert.deepEqual(
    [
      viewFilters(view({ dateMode: "year" }), "2027-12-31").start,
      viewFilters(view({ dateMode: "year" }), "2027-12-31").end,
    ],
    ["2027-01-01", "2027-12-31"],
  );
  assert.equal(viewFilters(view(), "2026-10-18").start, undefined);
  assert.equal(
    viewFilters(
      view({ dateMode: "range", start: "2026-01-01", end: "2026-02-01" }),
      "2028-01-01",
    ).start,
    "2026-01-01",
  );
});

test("saved view validation protects names, dates, limits, IDs and backend writes while tolerating removed filters", () => {
  const state = putSavedView(base(), view());
  assert.equal(state.savedViews.length, 1);
  validate(state);
  assert.throws(
    () => putSavedView(state, view({ id: "other", name: "GROCERIES" })),
    /already uses/,
  );
  assert.throws(
    () => validate({ ...state, savedViews: [view(), view()] }),
    /unique/,
  );
  for (const bad of [
    { name: "" },
    { name: "x".repeat(61) },
    { type: "unknown" },
    { search: "x".repeat(501) },
    { dateMode: "range", start: "2026-02-30", end: "2026-03-01" },
    { dateMode: "current", start: "2026-01-01" },
  ])
    assert.throws(() => validateSavedView(view(bad)));
  validateSavedView(
    view({ category: "removed-category", account: "removed-account" }),
  );
  const renamed = putSavedView(state, view({ name: "Food purchases" }));
  assert.equal(renamed.savedViews.length, 1);
  assert.deepEqual(
    deserialize(serialize(renamed)).savedViews,
    renamed.savedViews,
  );
});

test("saved views persist in Markdown, survive ZIP recovery, and migrate older vaults safely", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "clarity-views-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new Store(path.join(root, "vault"));
  await store.init();
  const initial = await store.read();
  const saved = await store.save(
    putSavedView(base(), view({ name: "Food | purchases" })),
    initial.revision,
  );
  assert.match(
    await readFile(path.join(store.dir, "SavedViews.md"), "utf8"),
    /Food &#124; purchases/,
  );
  const reopened = new Store(store.dir);
  await reopened.init();
  assert.deepEqual(
    (await reopened.read()).state.savedViews,
    saved.state.savedViews,
  );
  const backups = new Backups(store),
    exported = await backups.export(),
    preview = await backups.preview({ archive: exported.archive });
  const destination = await backups.restoreNew(
    preview.token,
    path.join(root, "restored"),
  );
  assert.deepEqual(
    (await new Store(destination).read()).state.savedViews,
    saved.state.savedViews,
  );
  await unlink(path.join(store.dir, "SavedViews.md"));
  await assert.rejects(new Store(store.dir).init(), /SavedViews.md is missing/);
  const index = await readFile(path.join(store.dir, "Money.md"), "utf8");
  await writeFile(
    path.join(store.dir, "Money.md"),
    index.replace("- [[SavedViews]]\n", ""),
  );
  const migrated = new Store(store.dir);
  await migrated.init();
  const next = await migrated.read();
  assert.deepEqual(next.state.savedViews, []);
  assert.deepEqual(next.state.transactions, saved.state.transactions);
  assert.ok(
    (await readdir(path.join(store.dir, ".backups"))).some((n) =>
      n.startsWith("upgrade-"),
    ),
  );
});

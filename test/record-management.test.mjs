import test from "node:test";
import assert from "node:assert/strict";
import {
  editAccount,
  removeAccount,
  removeCategory,
  forgetMerchantCategory,
} from "../public/record-management.js";
import { emptyState, validate, serialize, deserialize } from "../lib/store.mjs";
import {
  rememberCategory,
  applyMerchantLearning,
  upgradeState,
} from "../public/money-model.js";
import { approvedNames } from "../public/merchant-groups.js";
import { normalizeCSV, parseCSV } from "../public/core.js";
import { makeProfile, mappingDefaults } from "../public/import-profiles.js";

function ledger() {
  const s = emptyState();
  s.accounts = [
    { id: "a", name: "First", type: "bank" },
    { id: "b", name: "Second", type: "savings" },
    { id: "card", name: "Card", type: "credit" },
  ];
  s.transactions = [
    {
      id: "t",
      date: "2026-10-01",
      description: "Coffee",
      amount: 500,
      category: "dining",
      kind: "expense",
      account: "a",
      review: false,
      source: "manual",
    },
  ];
  s.balances = [
    { id: "bal", account: "a", date: "2026-10-01", amount: 120000 },
  ];
  return s;
}

test("account editing preserves record IDs and resets only incompatible import profiles", () => {
  const s = ledger();
  s.importProfiles = [
    makeProfile("a", "bank", ",", 1, mappingDefaults(), [
      "Date",
      "Description",
      "Amount",
    ]),
  ];
  const renamed = editAccount(s, "a", "Renamed savings", "savings");
  validate(renamed);
  assert.equal(renamed.importProfiles.length, 1);
  assert.deepEqual(renamed.transactions, s.transactions);
  const changed = editAccount(s, "a", "Corrected card", "credit");
  validate(changed);
  assert.equal(changed.importProfiles.length, 0);
  assert.equal(changed.balances[0].amount, 120000);
  assert.equal(changed.accounts[0].id, "a");
});

test("account deletion requires a deliberate record policy and preserves unrelated records", () => {
  const s = ledger();
  assert.throws(() => removeAccount(s, "a"), /confirm/);
  assert.throws(
    () => removeAccount(s, "a", { destination: "missing" }),
    /different account/,
  );
  assert.throws(
    () => removeAccount(s, "a", { destination: "card" }),
    /asset or debt/,
  );
  const moved = removeAccount(s, "a", { destination: "b" });
  validate(moved);
  assert.equal(moved.transactions[0].account, "b");
  assert.equal(moved.balances[0].amount, 120000);
  assert.equal(moved.balances[0].account, "b");
  assert.equal(s.transactions[0].account, "a");
  const deleted = removeAccount(s, "a", { deleteRecords: true });
  validate(deleted);
  assert.equal(deleted.transactions.length, 0);
  assert.equal(deleted.balances.length, 0);
  assert.deepEqual(
    deleted.accounts.map((a) => a.id),
    ["b", "card"],
  );
  assert.equal(deserialize(serialize(moved)).transactions[0].account, "b");
});

test("moving account records never overwrites a same-day balance", () => {
  const s = ledger();
  s.balances.push({
    id: "other",
    account: "b",
    date: "2026-10-01",
    amount: 200,
  });
  assert.throws(() => removeAccount(s, "a", { destination: "b" }), /same date/);
  assert.equal(s.balances.length, 2);
});

test("deleting a category preserves children, transactions, and valid references", () => {
  let s = ledger();
  s.categories.push({
    id: "child",
    name: "Coffee",
    color: "#123456",
    budget: 1000,
    parentId: "dining",
    budgetScope: "separate",
  });
  s.budgetOverrides = [
    {
      id: "dining:2026-10",
      category: "dining",
      month: "2026-10",
      budget: 10000,
      note: "Guests",
    },
  ];
  s = rememberCategory(s, s.transactions[0]);
  const next = removeCategory(s, "dining", "groceries");
  validate(next);
  assert.equal(next.transactions[0].amount, 500);
  assert.equal(next.transactions[0].category, "groceries");
  assert.equal(next.categories.find((c) => c.id === "child").parentId, "");
  assert.equal(next.categories.find((c) => c.id === "child").budget, 1000);
  assert.equal(next.budgetOverrides.length, 0);
  assert.equal(next.merchantRules[0].category, "groceries");
  assert.throws(() => removeCategory(s, "uncategorized"), /cannot be deleted/);
});

test("forgetting a merchant survives Markdown reload and blocks historical autofill", () => {
  let s = rememberCategory(ledger(), ledger().transactions[0]);
  s = rememberCategory(s, {
    ...s.transactions[0],
    description: "Another statement alias",
    merchant: "Coffee",
  });
  const forgotten = deserialize(
    serialize(forgetMerchantCategory(s, s.merchantRules[0].key)),
  );
  const pending = {
    ...s.transactions[0],
    id: "new",
    category: "uncategorized",
  };
  assert.equal(
    applyMerchantLearning([pending], forgotten)[0].category,
    "uncategorized",
  );
  assert.equal(approvedNames(forgotten, "expense").length, 0);
  assert.ok(
    forgotten.merchantRules.every((r) => r.category === "uncategorized"),
  );
  assert.equal(
    applyMerchantLearning(
      [
        {
          ...pending,
          merchant: "Coffee",
          description: "Previously unseen statement text",
        },
      ],
      forgotten,
    )[0].category,
    "uncategorized",
  );
  assert.equal(forgotten.transactions[0].category, "dining");
  const resumed = rememberCategory(forgotten, s.transactions[0]);
  assert.equal(applyMerchantLearning([pending], resumed)[0].category, "dining");
});

test("income and transfers consistently have no category in new imports and legacy state", () => {
  const rows = parseCSV(
    "Date,Description,Amount\n2026-10-01,Salary,100\n2026-10-02,Transfer,-20\n2026-10-03,Coffee,-5",
  );
  const parsed = normalizeCSV(
    rows,
    {
      start: 1,
      date: 0,
      description: 1,
      amount: 2,
      layout: "single",
      dateFormat: "YMD",
      sign: "negative-expense",
      decimal: ".",
    },
    { id: "a", type: "bank" },
  );
  assert.deepEqual(
    parsed.transactions.map((t) => t.category),
    ["", "", "uncategorized"],
  );
  const s = ledger();
  s.transactions[0].kind = "income";
  assert.equal(upgradeState(s).transactions[0].category, "");
});

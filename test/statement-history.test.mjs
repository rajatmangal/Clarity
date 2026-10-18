import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  readFile,
  writeFile,
  rm,
  readdir,
  unlink,
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
  recordImport,
  undoImport,
  undoPreview,
  confirmCoverage,
  accountCoverage,
  coverageStatus,
} from "../public/statement-history.js";
import { removeAccount } from "../public/record-management.js";

const initial = () => ({
  ...emptyState(),
  accounts: [{ id: "a", name: "Card", type: "credit" }],
});
const tx = (id = "t", date = "2026-09-10") => ({
  id,
  date,
  description: "Store | name\nSecond line",
  amount: 1000,
  kind: "expense",
  category: "uncategorized",
  account: "a",
  review: false,
  source: "import",
  merchant: "Store",
  location: "",
  reference: "",
});
const batch = (id = "b", start = "2026-09-01", end = "2026-09-30") => ({
  id,
  account: "a",
  accountName: "Card",
  filename: "September | transactions.csv",
  hash: "a".repeat(64),
  createdAt: "2026-10-17T12:00:00.000Z",
  start,
  end,
  duplicates: 0,
  skipped: 0,
  invalid: 0,
  warnings: "",
});
const imported = () =>
  recordImport(initial(), {
    batch: batch(),
    transactions: [tx()],
    complete: true,
  });

test("import metadata, escaped snapshots and counts round-trip through Markdown", () => {
  const s = imported();
  validate(s);
  assert.deepEqual(deserialize(serialize(s)), s);
  assert.equal(accountCoverage(s, "a", "2026-09-01", "2026-09-30"), "complete");
});
test("dates outside the declared period are rejected", () => {
  assert.throws(
    () =>
      recordImport(initial(), {
        batch: batch(),
        transactions: [tx("t", "2026-10-01")],
      }),
    /include every/,
  );
  assert.throws(
    () =>
      recordImport(initial(), {
        batch: batch("b", "2026-09-31"),
        transactions: [],
      }),
    /valid statement/,
  );
});
test("skipped or invalid rows prevent automatic complete coverage", () => {
  for (const key of ["skipped", "invalid"]) {
    const s = recordImport(initial(), {
      batch: { ...batch(), [key]: 1 },
      transactions: [tx()],
      complete: true,
    });
    assert.equal(
      accountCoverage(s, "a", "2026-09-01", "2026-09-30"),
      "partial",
    );
  }
});
test("duplicate-only statements retain history without creating transactions", () => {
  const s = recordImport(imported(), {
    batch: { ...batch("second"), duplicates: 1 },
    transactions: [],
    complete: true,
  });
  validate(s);
  const undone = undoImport(s, "second");
  assert.equal(undone.transactions.length, 1);
  assert.equal(
    accountCoverage(undone, "a", "2026-09-01", "2026-09-30"),
    "complete",
  );
});
test("undo protects edited transactions, ignores already deleted entries, and preserves unrelated data", () => {
  let s = recordImport(initial(), {
    batch: batch(),
    transactions: [tx("one"), tx("two"), tx("three")],
    complete: true,
  });
  s = {
    ...s,
    transactions: [
      s.transactions[0],
      { ...s.transactions[1], amount: 1500 },
      { ...tx("manual"), source: "manual" },
    ],
  };
  const preview = undoPreview(s, "b");
  assert.deepEqual(
    [preview.unchanged.length, preview.edited.length, preview.missing.length],
    [1, 1, 1],
  );
  const next = undoImport(s, "b");
  assert.deepEqual(
    next.transactions.map((t) => t.id),
    ["two", "manual"],
  );
  assert.equal(next.accounts.length, 1);
  assert.equal(next.importEntries.length, 3);
  assert.equal(next.importBatches[0].status, "undone");
  assert.equal(
    accountCoverage(next, "a", "2026-09-01", "2026-09-30"),
    "missing",
  );
  assert.throws(() => undoImport(next, "b"), /not active/);
  assert.deepEqual(
    undoImport(s, "b", { removeEdited: true }).transactions.map((t) => t.id),
    ["manual"],
  );
  validate(next);
});
test("category and review edits preserve coverage but are protected by undo", () => {
  const s = imported();
  s.transactions[0] = {
    ...s.transactions[0],
    category: s.categories[1].id,
    review: true,
  };
  assert.equal(coverageStatus(s, s.statementCoverage[0]), "confirmed");
  assert.equal(undoPreview(s, "b").edited.length, 1);
});
test("financial edits, additions and deletions invalidate confirmed coverage", () => {
  const s = imported();
  for (const transactions of [
    [],
    [{ ...s.transactions[0], amount: 2000 }],
    [{ ...s.transactions[0], date: "2026-10-01" }],
    [...s.transactions, tx("extra")],
  ]) {
    assert.equal(
      coverageStatus({ ...s, transactions }, s.statementCoverage[0]),
      "needs-review",
    );
  }
});
test("no activity is explicit, requires no records, and becomes stale on new entries", () => {
  const record = {
    id: "none",
    account: "a",
    start: "2026-09-01",
    end: "2026-09-30",
    status: "no-activity",
    note: "Checked",
  };
  const s = confirmCoverage(initial(), record);
  assert.equal(accountCoverage(s, "a", record.start, record.end), "complete");
  assert.equal(
    accountCoverage(initial(), "a", record.start, record.end),
    "missing",
  );
  assert.throws(() => confirmCoverage(imported(), record), /has transactions/);
  assert.equal(
    accountCoverage(
      { ...s, transactions: [tx()] },
      "a",
      record.start,
      record.end,
    ),
    "partial",
  );
});
test("coverage unions adjacent and overlapping periods but never bridges gaps", () => {
  let s = initial();
  const add = (id, start, end) => {
    s = confirmCoverage(s, {
      id,
      account: "a",
      start,
      end,
      status: "confirmed",
      note: "",
    });
  };
  add("first", "2026-09-01", "2026-09-14");
  add("second", "2026-09-16", "2026-09-30");
  assert.equal(accountCoverage(s, "a", "2026-09-01", "2026-09-30"), "partial");
  add("gap", "2026-09-14", "2026-09-16");
  assert.equal(accountCoverage(s, "a", "2026-09-01", "2026-09-30"), "complete");
  assert.equal(accountCoverage(s, "a", "2026-08-01", "2026-09-30"), "partial");
});
test("undo invalidates overlapping independent manual confirmations", () => {
  const s = confirmCoverage(imported(), {
    id: "manual",
    account: "a",
    start: "2026-09-01",
    end: "2026-09-30",
    status: "confirmed",
    note: "",
  });
  const next = undoImport(s, "b");
  assert.equal(coverageStatus(next, next.statementCoverage[1]), "needs-review");
  assert.equal(
    accountCoverage(next, "a", "2026-09-01", "2026-09-30"),
    "partial",
  );
});
test("account deletion preserves audit history but removes its coverage", () => {
  const s = removeAccount(imported(), "a", { deleteRecords: true });
  validate(s);
  assert.equal(s.statementCoverage.length, 0);
  assert.equal(s.importBatches[0].accountName, "Card");
  assert.equal(undoPreview(s, "b").missing.length, 1);
});
test("validation rejects corrupt history relationships and counts", () => {
  const s = imported();
  assert.throws(() => validate({ ...s, importEntries: [] }), /count/);
  assert.throws(
    () =>
      validate({
        ...s,
        importEntries: [{ ...s.importEntries[0], batch: "absent" }],
      }),
    /entry/,
  );
  assert.throws(
    () =>
      validate({
        ...s,
        statementCoverage: [{ ...s.statementCoverage[0], snapshot: "broken" }],
      }),
    /snapshot/,
  );
});
test("existing multi-file vault upgrades safely, preserves notes, and rejects a missing new history file", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "clarity-statements-"));
  try {
    let store = new Store(dir);
    await store.init();
    // Simulate a vault created before import history existed.
    for (const name of ["ImportBatches", "ImportEntries", "StatementCoverage"])
      await unlink(path.join(dir, name + ".md"));
    await writeFile(
      path.join(dir, "Accounts.md"),
      (await readFile(path.join(dir, "Accounts.md"), "utf8")) +
        "\nKeep my notes\n",
    );
    store = new Store(dir);
    await store.init();
    assert.ok(
      (await readFile(path.join(dir, "Accounts.md"), "utf8")).includes(
        "Keep my notes",
      ),
    );
    assert.ok(
      (await readdir(path.join(dir, ".backups"))).some((name) =>
        name.startsWith("upgrade-"),
      ),
    );
    let current = await store.read();
    current = await store.save(imported(), current.revision);
    const reopened = new Store(dir);
    await reopened.init();
    assert.equal((await reopened.read()).state.importBatches.length, 1);
    await store.save(undoImport(current.state, "b"), current.revision);
    assert.equal((await store.read()).state.transactions.length, 0);
    await unlink(path.join(dir, "ImportEntries.md"));
    await assert.rejects(new Store(dir).init(), /history file is missing/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

import { hasSplits, deleteTransactions } from "./transaction-splits.js";
import { validDate } from "./dates.js";

const fields = [
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
];
export const transactionSnapshot = (t) =>
  JSON.stringify(fields.map((key) => t[key] ?? ""));
// Category/review changes do not change whether a statement's money is present.
export function coverageSnapshot(state, account, start, end) {
  return JSON.stringify(
    state.transactions
      .filter((t) => t.account === account && t.date >= start && t.date <= end)
      .map((t) => [t.id, t.date, t.amount, t.kind])
      .sort((a, b) => a[0].localeCompare(b[0])),
  );
}
export function assertPeriod(start, end) {
  if (!validDate(start) || !validDate(end) || start > end)
    throw Error("Choose a valid statement start and end date.");
}
export function recordImport(state, { batch, transactions, complete = false }) {
  assertPeriod(batch.start, batch.end);
  if (
    transactions.some(
      (t) =>
        t.account !== batch.account ||
        t.date < batch.start ||
        t.date > batch.end,
    )
  )
    throw Error(
      "The statement period must include every imported transaction.",
    );
  const next = {
    ...state,
    transactions: [...state.transactions, ...transactions],
  };
  return {
    ...next,
    importBatches: [
      ...(state.importBatches || []),
      {
        ...batch,
        imported: transactions.length,
        status: "active",
        undoneAt: "",
      },
    ],
    importEntries: [
      ...(state.importEntries || []),
      ...transactions.map((t) => ({
        id: `${batch.id}:${t.id}`,
        batch: batch.id,
        transaction: t.id,
        snapshot: transactionSnapshot(t),
      })),
    ],
    statementCoverage: [
      ...(state.statementCoverage || []),
      {
        id: batch.id,
        account: batch.account,
        start: batch.start,
        end: batch.end,
        status:
          complete && !batch.invalid && !batch.skipped
            ? "confirmed"
            : "partial",
        batch: batch.id,
        note: "",
        snapshot: coverageSnapshot(next, batch.account, batch.start, batch.end),
      },
    ],
  };
}
export function undoPreview(state, id) {
  const batch = (state.importBatches || []).find(
    (b) => b.id === id && b.status === "active",
  );
  if (!batch) throw Error("This import is not active.");
  const records = new Map(state.transactions.map((t) => [t.id, t]));
  const result = { unchanged: [], edited: [], missing: [] };
  for (const entry of (state.importEntries || []).filter(
    (e) => e.batch === id,
  )) {
    const current = records.get(entry.transaction);
    result[
      !current
        ? "missing"
        : !hasSplits(state, current) &&
            transactionSnapshot(current) === entry.snapshot
          ? "unchanged"
          : "edited"
    ].push(current || { id: entry.transaction });
  }
  return result;
}
export function undoImport(
  state,
  id,
  { removeEdited = false, now = new Date().toISOString() } = {},
) {
  const preview = undoPreview(state, id);
  const removed = new Set(
    [...preview.unchanged, ...(removeEdited ? preview.edited : [])].map(
      (t) => t.id,
    ),
  );
  return {
    ...deleteTransactions(state, removed),
    importBatches: state.importBatches.map((b) =>
      b.id === id ? { ...b, status: "undone", undoneAt: now } : b,
    ),
    // Keep audit history, including its period. Undone coverage is ignored below.
  };
}
export function confirmCoverage(state, record) {
  assertPeriod(record.start, record.end);
  if (!state.accounts.some((a) => a.id === record.account))
    throw Error("Choose an existing account.");
  if (!["confirmed", "partial", "no-activity"].includes(record.status))
    throw Error("Choose a valid coverage status.");
  const snapshot = coverageSnapshot(
    state,
    record.account,
    record.start,
    record.end,
  );
  if (record.status === "no-activity" && snapshot !== "[]")
    throw Error(
      "This account has transactions in that period. Use Confirmed complete instead.",
    );
  const next = { ...record, batch: "", snapshot };
  return {
    ...state,
    statementCoverage: [
      ...(state.statementCoverage || []).filter((c) => c.id !== record.id),
      next,
    ],
  };
}
export function coverageStatus(state, c) {
  if (
    c.batch &&
    !(state.importBatches || []).some(
      (b) => b.id === c.batch && b.status === "active",
    )
  )
    return "undone";
  if (c.snapshot !== coverageSnapshot(state, c.account, c.start, c.end))
    return "needs-review";
  return c.status;
}
const nextDay = (date) => {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};
export function accountCoverage(state, account, start, end, statuses) {
  assertPeriod(start, end);
  const periods = (state.statementCoverage || [])
    .filter((c) => c.account === account && c.end >= start && c.start <= end)
    .map((c) => ({
      ...c,
      effective: statuses?.get(c.id) || coverageStatus(state, c),
    }))
    .filter((c) => c.effective !== "undone");
  const confirmed = periods
    .filter((c) => ["confirmed", "no-activity"].includes(c.effective))
    .sort((a, b) => a.start.localeCompare(b.start));
  let cursor = start;
  for (const c of confirmed) {
    if (c.start > cursor) break;
    if (c.end >= end) return "complete";
    if (c.end >= cursor) cursor = nextDay(c.end);
  }
  return periods.length ? "partial" : "missing";
}

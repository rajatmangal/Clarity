export const splitsFor = (state, id) =>
  (state.transactionSplits || []).filter((s) => s.transaction === id);
export const hasSplits = (state, t) =>
  (state.transactionSplits || []).some((s) => s.transaction === t.id);

// Category views use allocations. Ledger/account views always keep the parent.
export function categoryTransactions(state) {
  const grouped = new Map();
  for (const s of state.transactionSplits || []) {
    if (!grouped.has(s.transaction)) grouped.set(s.transaction, []);
    grouped.get(s.transaction).push(s);
  }
  return state.transactions.flatMap((t) =>
    grouped.has(t.id)
      ? grouped.get(t.id).map((s) => ({
          ...t,
          id: s.id,
          parentTransaction: t.id,
          category: s.category,
          amount: s.amount,
          allocationNote: s.note,
        }))
      : [t],
  );
}
export function categoryAmount(state, t, ids) {
  const rows = splitsFor(state, t.id);
  return (rows.length ? rows : [t])
    .filter((s) => ids.has(s.category))
    .reduce((n, s) => n + s.amount, 0);
}
export function deleteTransactions(state, ids) {
  const removed = new Set(ids);
  return {
    ...state,
    transactions: state.transactions.filter((t) => !removed.has(t.id)),
    transactionSplits: (state.transactionSplits || []).filter(
      (s) => !removed.has(s.transaction),
    ),
  };
}
export function setTransactionSplits(state, transaction, rows) {
  return {
    ...state,
    transactionSplits: [
      ...(state.transactionSplits || []).filter(
        (s) => s.transaction !== transaction,
      ),
      ...rows.map((s) => ({ ...s, transaction })),
    ],
  };
}
export function parseSplitValue(value) {
  const text = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text))
    throw Error(
      "Enter a positive value with at most two decimal places for every allocation.",
    );
  const [whole, fraction = ""] = text.split(".");
  const n = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(n) || n <= 0)
    throw Error("Every allocation must be greater than zero.");
  return n;
}
export function splitBalance(total, rows, mode = "amount") {
  const allocated = rows.reduce((n, r) => {
    try {
      return n + parseSplitValue(r.value);
    } catch {
      return n;
    }
  }, 0);
  const target = mode === "percent" ? 10000 : total;
  return { allocated, remaining: target - allocated, over: allocated > target };
}
// Largest-remainder allocation keeps percentage rounding exact, including cents.
export function percentageAmounts(total, weights) {
  if (
    !Number.isSafeInteger(total) ||
    total <= 0 ||
    weights.some((n) => !Number.isSafeInteger(n) || n <= 0) ||
    weights.reduce((n, v) => n + v, 0) !== 10000
  )
    throw Error("Allocation percentages must total exactly 100%.");
  const products = weights.map((w) => BigInt(total) * BigInt(w));
  const amounts = products.map((n) => Number(n / 10000n));
  const order = products
    .map((n, i) => ({ i, remainder: n % 10000n }))
    .sort((a, b) =>
      a.remainder === b.remainder
        ? a.i - b.i
        : a.remainder > b.remainder
          ? -1
          : 1,
    );
  const remaining = total - amounts.reduce((n, v) => n + v, 0);
  for (let i = 0; i < remaining; i++) amounts[order[i].i]++;
  if (amounts.some((n) => n <= 0))
    throw Error(
      "The total is too small for these percentages. Every allocation must receive at least one cent.",
    );
  return amounts;
}
export function draftSplits(total, rows, mode, categories) {
  if (rows.length < 2 || rows.length > 100)
    throw Error("A split needs between 2 and 100 allocations.");
  const values = rows.map((r) => parseSplitValue(r.value));
  const amounts =
    mode === "percent" ? percentageAmounts(total, values) : values;
  if (amounts.reduce((n, v) => n + v, 0) !== total)
    throw Error(
      "Allocation amounts must equal the original transaction total.",
    );
  return rows.map((r, i) => {
    if (
      !r.category ||
      r.category === "uncategorized" ||
      !categories.some((c) => c.id === r.category)
    )
      throw Error("Choose a category for every allocation.");
    if (typeof r.note !== "string" || r.note.length > 500)
      throw Error("Allocation notes must be 500 characters or fewer.");
    return { id: r.id, category: r.category, amount: amounts[i], note: r.note };
  });
}

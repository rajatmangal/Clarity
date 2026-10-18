import { splitsFor } from "../public/transaction-splits.js";
import { categoryIds, categoryLabel } from "../public/money-model.js";

export function csvCell(value) {
  let text = value == null ? "" : String(value);
  if (
    typeof value !== "number" &&
    (/^[\s\uFEFF]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text))
  )
    text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
export function transactionCSV(state, { ids, category = "all" } = {}) {
  if (
    ids !== undefined &&
    (!Array.isArray(ids) ||
      ids.length > 100000 ||
      ids.some((id) => typeof id !== "string"))
  )
    throw Error("Invalid transaction selection.");
  const selected = ids ? new Set(ids) : null;
  const categories =
    category === "all"
      ? null
      : new Set(categoryIds(state.categories, category));
  const rows = [
    [
      "Transaction ID",
      "Allocation ID",
      "Date",
      "Type",
      "Merchant",
      "Description",
      "Account",
      "Category",
      "Amount",
      "Net Spending",
      "Original Total (first allocation only)",
      "Currency",
      "Allocation Note",
      "Location",
      "Reference",
    ],
  ];
  for (const t of state.transactions
    .filter((t) => !selected || selected.has(t.id))
    .sort((a, b) => a.date.localeCompare(b.date))) {
    const allocations = splitsFor(state, t.id),
      parts = (
        allocations.length
          ? allocations
          : [{ category: t.category, amount: t.amount }]
      ).filter((s) => !categories || categories.has(s.category));
    parts.forEach((s, i) =>
      rows.push([
        t.id,
        allocations.length ? s.id : "",
        t.date,
        t.kind,
        t.merchant,
        t.description,
        state.accounts.find((a) => a.id === t.account)?.name || "",
        categoryLabel(state.categories, s.category),
        s.amount / 100,
        (t.kind === "expense"
          ? s.amount
          : t.kind === "refund"
            ? -s.amount
            : 0) / 100,
        i === 0 ? t.amount / 100 : "",
        state.currency,
        s.note || "",
        t.location,
        t.reference,
      ]),
    );
  }
  return (
    "\uFEFF" +
    rows.map((row) => row.map(csvCell).join(",")).join("\r\n") +
    "\r\n"
  );
}

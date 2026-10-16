import { inferDateOrder } from "./dates.js";
import { budgetPlan } from "./budget-plan.js";
import { extractMerchant, applyMerchantLearning } from "./money-model.js";
import { parseDate } from "./dates.js";
export { parseDate, validDate } from "./dates.js";
export const kinds = ["expense", "income", "refund", "transfer"];
export const defaultCategories = [
  ["housing", "Housing", "#9074d9"],
  ["groceries", "Groceries", "#b39ae8"],
  ["dining", "Dining & coffee", "#e7a275"],
  ["transport", "Transport", "#81b7ae"],
  ["shopping", "Shopping", "#dec47b"],
  ["bills", "Bills & subscriptions", "#89a9d7"],
  ["health", "Health", "#db9bb7"],
  ["travel", "Travel", "#9ba67b"],
  ["entertainment", "Entertainment", "#aaa4cf"],
  ["other", "Other", "#9d9d9d"],
  ["uncategorized", "Uncategorized", "#c6c6ce"],
].map(([id, name, color]) => ({
  id,
  name,
  color,
  budget: 0,
  parentId: "",
  budgetScope: "separate",
}));
export function parseCSV(text, delimiter = ",") {
  text = text.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (quoted || !cell) quoted = !quoted;
      else cell += c;
    } else if (c === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted)
    throw Error("An opening quote has no closing quote. Check the CSV file.");
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
export function cents(value, decimal = ".") {
  let s = String(value ?? "").trim();
  if (!s) return null;
  let neg = /^\(.*\)$/.test(s);
  s = s.replace(/[()\s$€£₹]/g, "").replace(/^(CAD|USD|INR)\s*/i, "");
  if (decimal === ",") s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  if (!/^[+-]?\d+(\.\d{1,2})?$/.test(s))
    throw Error(`Invalid amount: ${value}`);
  const n = Math.round(Number(s) * 100) * (neg ? -1 : 1);
  if (!Number.isSafeInteger(n)) throw Error("Amount is too large");
  return n;
}
export function normalizeCSV(rows, map, account, existing = []) {
  const out = [],
    errors = [];
  const counts = new Map();
  const oldCounts = new Map();
  existing.forEach((t) =>
    oldCounts.set(fingerprint(t), (oldCounts.get(fingerprint(t)) || 0) + 1),
  );
  const dateInference =
    !map.dateFormat || map.dateFormat === "AUTO"
      ? inferDateOrder(rows.slice(map.start).map((r) => r[map.date]))
      : null;
  rows.slice(map.start).forEach((r, idx) => {
    if (r.every((v) => !v.trim())) return;
    try {
      const date = parseDate(
          r[map.date],
          dateInference?.format || map.dateFormat,
          map,
        ),
        description = String(r[map.description] || "").trim();
      if (!description) throw Error("Missing description");
      let signed;
      if (map.layout === "split") {
        const debit = cents(r[map.debit], map.decimal) || 0,
          credit = cents(r[map.credit], map.decimal) || 0;
        if (debit < 0 || credit < 0)
          throw Error("Split debit and credit columns must be positive");
        if (debit && credit) throw Error("Both debit and credit have amounts");
        signed = credit - debit;
      } else {
        const v = cents(r[map.amount], map.decimal);
        if (v === null) throw Error("Missing amount");
        signed = map.sign === "positive-expense" ? -v : v;
      }
      if (signed === 0) throw Error("Zero amount; review or skip this row");
      let kind =
        signed < 0
          ? "expense"
          : account.type === "credit"
            ? "refund"
            : "income";
      let review = false;
      if (
        /^payment$|payment received|payment thank|autopay|credit card payment|payment to.*(visa|mastercard)|transfer|e-transfer/i.test(
          description,
        )
      ) {
        kind = "transfer";
        review = true;
      }
      const t = {
        id: crypto.randomUUID(),
        date,
        description,
        ...extractMerchant(description),
        amount: Math.abs(signed),
        kind,
        category: "uncategorized",
        account: account.id,
        review,
        source: "import",
        row: idx + map.start + 1,
      };
      const f = fingerprint(t),
        occ = (counts.get(f) || 0) + 1;
      counts.set(f, occ);
      t.duplicate = occ <= (oldCounts.get(f) || 0);
      out.push(t);
    } catch (e) {
      errors.push({ row: idx + map.start + 1, message: e.message });
    }
  });
  return { transactions: out, errors, dateInference };
}
export function fingerprint(t) {
  return [
    t.account,
    t.date,
    (t.description || t.merchant || "").trim().toLowerCase(),
    t.amount,
  ].join("|");
}
export function summarize(state, start, end) {
  const tx = state.transactions.filter((t) => t.date >= start && t.date <= end);
  const expense = tx
      .filter((t) => t.kind === "expense")
      .reduce((s, t) => s + t.amount, 0),
    refunds = tx
      .filter((t) => t.kind === "refund")
      .reduce((s, t) => s + t.amount, 0),
    income = tx
      .filter((t) => t.kind === "income")
      .reduce((s, t) => s + t.amount, 0);
  const spending = expense - refunds;
  const categories = state.categories
    .map((c) => ({
      ...c,
      spent: tx
        .filter((t) => t.category === c.id)
        .reduce(
          (s, t) =>
            s +
            (t.kind === "expense"
              ? t.amount
              : t.kind === "refund"
                ? -t.amount
                : 0),
          0,
        ),
    }))
    .sort((a, b) => b.spent - a.spent);
  const plan = budgetPlan(state, start, end);
  for (const c of categories) {
    c.targetBudget = plan.targets[c.id];
    c.groupSpent =
      c.spent +
      categories
        .filter((child) => child.parentId === c.id)
        .reduce((n, child) => n + child.spent, 0);
    c.budgetSpent = c.budgetScope === "combined" ? c.groupSpent : c.spent;
  }
  return {
    tx,
    budgetTotal: plan.total,
    spending,
    income,
    refunds,
    net: income - spending,
    categories,
    review: tx.filter(needsReview).length,
  };
}
export function needsReview(transaction) {
  if (["manual", "reviewed"].includes(transaction.source)) return false;
  return (
    !!transaction.review ||
    (transaction.category === "uncategorized" &&
      ["expense", "refund"].includes(transaction.kind))
  );
}
export function budgetFactor(start, end) {
  let total = 0;
  for (
    let d = new Date(start + "T12:00:00Z");
    d.toISOString().slice(0, 10) <= end;
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    total +=
      1 /
      new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
      ).getUTCDate();
  }
  return total;
}
export function netWorth(state, at) {
  let missing = 0;
  const accounts = state.accounts.map((a) => {
    const b = state.balances
      .filter((b) => b.account === a.id && b.date <= at)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!b) missing++;
    return { ...a, balance: b?.amount ?? null, date: b?.date };
  });
  return {
    accounts,
    missing,
    total: accounts.reduce(
      (s, a) =>
        s +
        (a.balance === null
          ? 0
          : a.type === "credit" || a.type === "loan"
            ? -a.balance
            : a.balance),
      0,
    ),
  };
}
export function localCategorize(transactions, state) {
  return applyMerchantLearning(transactions, state);
}
export function demoState() {
  const state = {
    currency: "CAD",
    model: "gpt-4.1-mini",
    categories: structuredClone(defaultCategories),
    accounts: [
      { id: "checking", name: "Everyday chequing", type: "bank" },
      { id: "savings", name: "Rainy day fund", type: "savings" },
      { id: "visa", name: "Everyday Visa", type: "credit" },
    ],
    transactions: [],
    balances: [],
  };
  const now = new Date();
  const year = now.getFullYear(),
    month = now.getMonth();
  const budgets = {
    housing: 190000,
    groceries: 50000,
    dining: 25000,
    transport: 18000,
    shopping: 20000,
    bills: 15000,
    health: 10000,
    travel: 20000,
    entertainment: 10000,
  };
  state.categories.forEach((c) => (c.budget = budgets[c.id] || 0));
  for (let k = 5; k >= 0; k--) {
    const d = new Date(year, month - k, 1),
      ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    let add = (
      day,
      desc,
      amount,
      category,
      kind = "expense",
      account = "visa",
    ) =>
      state.transactions.push({
        id: crypto.randomUUID(),
        date: `${ym}-${String(day).padStart(2, "0")}`,
        description: desc,
        amount,
        category,
        kind,
        account,
        review: false,
        source: "demo",
      });
    add(1, "Monthly salary", 620000, "other", "income", "checking");
    add(1, "Home rent", 185000, "housing", "expense", "checking");
    for (let i = 0; i < 4; i++) {
      add(2 + i * 3, "Whole Foods Market", 11200 + k * 300, "groceries");
      add(
        3 + i * 3,
        "Neighbourhood coffee & kitchen",
        6800 - k * 400,
        "dining",
      );
    }
    add(7, "BC Hydro", 8500, "bills");
    add(8, "Internet", 6500, "bills");
    add(4, "TransLink", 11200, "transport");
    add(9, "Weekend supply shop", 22800 - k * 1200, "shopping");
    add(10, "Cinema", 4200, "entertainment");
    add(12, "Pharmacy", 3200, "health");
    add(13, "Visa payment", 100000, "other", "transfer", "checking");
    add(14, "Returned item", 2500, "shopping", "refund");
    for (const [account, amount] of [
      ["checking", 380000 + (5 - k) * 30000],
      ["savings", 1200000 + (5 - k) * 90000],
      ["visa", 78000 + k * 4000],
    ])
      state.balances.push({
        id: crypto.randomUUID(),
        account,
        date: `${ym}-14`,
        amount,
      });
  }
  return state;
}

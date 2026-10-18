import { categoryTransactions } from "./transaction-splits.js";
import { monthSlices, budgetPlan, monthCategories } from "./budget-plan.js";
import {
  plannedBudget,
  categoryIds,
  categoryLabel,
  merchantKey,
  transactionDetails,
} from "./money-model.js";
const net = (t) =>
  t.kind === "expense" ? t.amount : t.kind === "refund" ? -t.amount : 0;
export function analysisData(state, start, end, trendStart, category = "all") {
  const ids =
    category === "all"
      ? null
      : new Set(categoryIds(state.categories, category));
  const scoped = (t) => !ids || ids.has(t.category);
  const allocated = categoryTransactions(state);
  const all = allocated.filter((t) => t.date >= trendStart && t.date <= end);
  const current = allocated.filter(
    (t) => t.date >= start && t.date <= end && scoped(t),
  );
  const parent = state.categories.find((c) => c.id === category);
  const months = monthSlices(trendStart, end).map((m) => {
    const tx = all.filter((t) => t.date >= m.start && t.date <= m.end);
    const spend = tx.filter(scoped).reduce((n, t) => n + net(t), 0);
    const income = tx
      .filter((t) => t.kind === "income")
      .reduce((n, t) => n + t.amount, 0);
    const totalSpent = tx.reduce((n, t) => n + net(t), 0);
    const plan = budgetPlan(state, m.start, m.end);
    // A combined parent already includes child targets; separate scopes add them.
    const budget =
      category === "all"
        ? plan.total
        : parent?.parentId
          ? plan.targets[category]
          : Math.round(
              plannedBudget(
                monthCategories(state, m.month).filter((c) => ids.has(c.id)),
              ) * m.fraction,
            );
    const rootAmounts = {};
    for (const t of tx) {
      const c = state.categories.find((c) => c.id === t.category);
      const root = c?.parentId || c?.id || "none";
      rootAmounts[root] = (rootAmounts[root] || 0) + net(t);
    }
    return {
      month: m.month,
      label: m.month,
      Income: income / 100,
      Spending: totalSpent / 100,
      Surplus: (income - totalSpent) / 100,
      Selected: spend / 100,
      Budget: budget / 100,
      records: new Set(tx.map((t) => t.parentTransaction || t.id)).size,
      rootAmounts,
    };
  });
  const roots = state.categories
    .filter((c) => !c.parentId)
    .map((c) => ({
      ...c,
      total: months.reduce(
        (n, m) => n + Math.max(0, m.rootAmounts[c.id] || 0),
        0,
      ),
    }))
    .sort((a, b) => b.total - a.total)
    .filter((c) => c.total > 0)
    .slice(0, 5);
  const composition = months.map((m) => {
    const row = { label: m.label };
    for (const c of roots) row[c.id] = (m.rootAmounts[c.id] || 0) / 100;
    row.other =
      Object.entries(m.rootAmounts)
        .filter(([id]) => !roots.some((c) => c.id === id))
        .reduce((n, [, v]) => n + v, 0) / 100;
    return row;
  });
  const plan = budgetPlan(state, start, end);
  const budgets = state.categories
    .filter((c) => plan.targets[c.id] > 0 && (!ids || ids.has(c.id)))
    .map((c) => {
      const included = new Set(
        c.budgetScope === "combined"
          ? categoryIds(state.categories, c.id)
          : [c.id],
      );
      return {
        id: c.id,
        name: categoryLabel(state.categories, c.id),
        Spending:
          allocated
            .filter(
              (t) =>
                t.date >= start && t.date <= end && included.has(t.category),
            )
            .reduce((n, t) => n + net(t), 0) / 100,
        Budget: plan.targets[c.id] / 100,
        scope: c.budgetScope,
      };
    })
    .sort((a, b) => b.Spending - b.Budget - (a.Spending - a.Budget));
  const merchantMap = new Map();
  for (const t of current) {
    if (!["expense", "refund"].includes(t.kind)) continue;
    const detail = transactionDetails(t);
    const key = merchantKey(detail.merchant);
    const row = merchantMap.get(key) || {
      name: detail.merchant,
      Spending: 0,
      purchases: 0,
      purchaseIds: new Set(),
    };
    row.Spending += net(t) / 100;
    if (t.kind === "expense") row.purchaseIds.add(t.parentTransaction || t.id);
    row.purchases = row.purchaseIds.size;
    merchantMap.set(key, row);
  }
  const merchants = [...merchantMap.values()]
    .map(({ purchaseIds, ...row }) => row)
    .sort((a, b) => b.Spending - a.Spending)
    .filter((m) => m.Spending > 0)
    .slice(0, 10);
  const dailyMap = new Map();
  for (const t of current) {
    if (["expense", "refund"].includes(t.kind))
      dailyMap.set(t.date, (dailyMap.get(t.date) || 0) + net(t));
  }
  const daily = [];
  let running = 0;
  let day = new Date(start + "T00:00:00Z");
  for (let i = 0; i < 3660 && day.toISOString().slice(0, 10) <= end; i++) {
    const date = day.toISOString().slice(0, 10);
    const amount = dailyMap.get(date) || 0;
    running += amount;
    daily.push({ date, Spending: amount / 100, Cumulative: running / 100 });
    day.setUTCDate(day.getUTCDate() + 1);
  }
  const purchases = current.filter((t) => t.kind === "expense");
  const purchaseCount = new Set(
    purchases.map((t) => t.parentTransaction || t.id),
  ).size;
  const missing = new Set(
    current
      .filter(
        (t) =>
          ["expense", "refund"].includes(t.kind) &&
          (!t.category || t.category === "uncategorized"),
      )
      .map((t) => t.parentTransaction || t.id),
  ).size;
  return {
    months,
    roots,
    composition,
    budgets,
    merchants,
    daily,
    purchases: purchaseCount,
    average: purchaseCount
      ? Math.round(purchases.reduce((n, t) => n + t.amount, 0) / purchaseCount)
      : 0,
    missing,
    net: current.reduce((n, t) => n + net(t), 0),
    records: new Set(current.map((t) => t.parentTransaction || t.id)).size,
  };
}

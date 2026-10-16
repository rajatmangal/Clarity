import { plannedBudget } from "./money-model.js";
export const chartIds = [
  "cashflow",
  "category-trend",
  "budget-trend",
  "budget-actual",
  "merchants",
  "daily",
];
export function monthSlices(start, end) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(start || "") ||
    !/^\d{4}-\d{2}-\d{2}$/.test(end || "") ||
    start > end
  )
    return [];
  const out = [];
  let [y, m] = start.slice(0, 7).split("-").map(Number);
  for (let i = 0; i < 121; i++) {
    const month = `${y}-${String(m).padStart(2, "0")}`,
      days = new Date(Date.UTC(y, m, 0)).getUTCDate(),
      first = month + "-01",
      last = month + "-" + days;
    if (first > end) break;
    const from = start > first ? start : first,
      to = end < last ? end : last;
    out.push({
      month,
      start: from,
      end: to,
      fraction: (Number(to.slice(8)) - Number(from.slice(8)) + 1) / days,
    });
    if (++m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}
export function monthCategories(state, month) {
  return state.categories.map((c) => ({
    ...c,
    budget:
      state.budgetOverrides?.find(
        (o) => o.category === c.id && o.month === month,
      )?.budget ?? c.budget,
  }));
}
export function budgetPlan(state, start, end) {
  const targets = Object.fromEntries(state.categories.map((c) => [c.id, 0]));
  let total = 0;
  for (const s of monthSlices(start, end)) {
    const cats = monthCategories(state, s.month);
    for (const c of cats) targets[c.id] += c.budget * s.fraction;
    total += plannedBudget(cats) * s.fraction;
  }
  return {
    total: Math.round(total),
    targets: Object.fromEntries(
      Object.entries(targets).map(([k, v]) => [k, Math.round(v)]),
    ),
  };
}

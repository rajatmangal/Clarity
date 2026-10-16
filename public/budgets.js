import { cents } from "./core.js";
export function updateBudgets(categories, selected, amounts, scopes) {
  if (!selected.length) throw Error("Choose at least one category.");
  const ids = new Set(selected);
  if (selected.some((id) => !categories.some((c) => c.id === id)))
    throw Error("Unknown category.");
  return categories.map((c) => {
    if (!ids.has(c.id)) return c;
    const budget = cents(amounts[c.id]) ?? 0;
    if (budget < 0) throw Error("Budgets cannot be negative.");
    const budgetScope = c.parentId ? "separate" : scopes[c.id] || "separate";
    if (!["combined", "separate"].includes(budgetScope))
      throw Error("Choose a valid budget scope.");
    return { ...c, budget, budgetScope };
  });
}

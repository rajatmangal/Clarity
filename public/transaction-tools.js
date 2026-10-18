import { needsReview, validDate, kinds } from "./core.js";
import { categoryIds, categoryLabel } from "./money-model.js";
import { splitsFor } from "./transaction-splits.js";

export const viewDateModes = ["current", "month", "year", "range"];
export function validateSavedView(view) {
  const string = (value, max) =>
    typeof value === "string" && value.length <= max;
  if (
    !view ||
    !string(view.id, 100) ||
    !view.id ||
    !string(view.name, 60) ||
    !view.name.trim() ||
    view.name !== view.name.trim()
  )
    throw Error("Enter a view name of 1–60 characters.");
  if (
    !string(view.search, 500) ||
    !["all", "review", "reviewed", ...kinds].includes(view.type) ||
    !string(view.category, 100) ||
    !string(view.account, 100)
  )
    throw Error("Invalid saved view filters.");
  if (!viewDateModes.includes(view.dateMode))
    throw Error("Choose how dates should work for this view.");
  if (view.dateMode === "range") {
    if (
      !validDate(view.start) ||
      !validDate(view.end) ||
      view.start > view.end ||
      (new Date(view.end) - new Date(view.start)) / 864e5 > 3660
    )
      throw Error("Choose a valid date range of no more than ten years.");
  } else if (view.start !== "" || view.end !== "")
    throw Error("Only fixed-range views should store dates.");
}
export function putSavedView(state, view) {
  validateSavedView(view);
  const views = state.savedViews || [];
  if (
    views.some(
      (v) =>
        v.id !== view.id && v.name.toLowerCase() === view.name.toLowerCase(),
    )
  )
    throw Error("A saved view already uses that name. Choose another name.");
  if (!views.some((v) => v.id === view.id) && views.length >= 100)
    throw Error(
      "You can save up to 100 views. Remove a view before adding another.",
    );
  return {
    ...state,
    savedViews: [...views.filter((v) => v.id !== view.id), view],
  };
}
export function viewFilters(view, today) {
  const next = {
    search: view.search,
    type: view.type,
    category: view.category,
    account: view.account,
  };
  if (view.dateMode === "month") {
    const month = today.slice(0, 7),
      [year, number] = month.split("-").map(Number);
    return {
      ...next,
      start: month + "-01",
      end:
        month +
        "-" +
        String(new Date(Date.UTC(year, number, 0)).getUTCDate()).padStart(
          2,
          "0",
        ),
    };
  }
  if (view.dateMode === "year")
    return {
      ...next,
      start: today.slice(0, 4) + "-01-01",
      end: today.slice(0, 4) + "-12-31",
    };
  return view.dateMode === "range"
    ? { ...next, start: view.start, end: view.end }
    : next;
}
export function matchesTransaction(
  state,
  t,
  { search = "", type = "all", category = "all", account = "all" } = {},
) {
  if (
    type === "review"
      ? !needsReview(t, state)
      : type === "reviewed"
        ? needsReview(t, state)
        : type !== "all" && t.kind !== type
  )
    return false;
  if (account !== "all" && t.account !== account) return false;
  const parts = splitsFor(state, t.id);
  if (
    category !== "all" &&
    !(parts.length ? parts : [t]).some((s) =>
      categoryIds(state.categories, category).includes(s.category),
    )
  )
    return false;
  return [
    t.description,
    t.merchant,
    t.location,
    t.reference,
    state.accounts.find((a) => a.id === t.account)?.name,
    ...parts.map(
      (s) => categoryLabel(state.categories, s.category) + " " + s.note,
    ),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(search.toLowerCase());
}
export function bulkEditPlan(state, ids, patch) {
  if (
    !Array.isArray(ids) ||
    !ids.length ||
    ids.length > 100000 ||
    ids.some((id) => typeof id !== "string") ||
    new Set(ids).size !== ids.length
  )
    throw Error("Select at least one transaction, without duplicates.");
  const selected = new Set(ids),
    transactions = state.transactions.filter((t) => selected.has(t.id));
  if (transactions.length !== ids.length)
    throw Error(
      "Your selection changed. Close this dialog and select the transactions again.",
    );
  if (
    !patch ||
    Object.keys(patch).some(
      (k) => !["category", "account", "review", "includeSplits"].includes(k),
    )
  )
    throw Error("Unsupported bulk edit.");
  const category = patch.category ?? null,
    account = patch.account ?? null,
    review = patch.review ?? "keep",
    includeSplits = patch.includeSplits ?? false;
  if (category !== null && !state.categories.some((c) => c.id === category))
    throw Error("Choose an existing category.");
  if (
    account !== null &&
    account !== "" &&
    !state.accounts.some((a) => a.id === account)
  )
    throw Error("Choose an existing account.");
  if (account === "" && transactions.some((t) => t.kind === "expense"))
    throw Error(
      "Expenses need an account. Choose an account, or leave accounts unchanged.",
    );
  if (
    !["keep", "reviewed", "needs-review"].includes(review) ||
    typeof includeSplits !== "boolean"
  )
    throw Error("Choose a valid review status and split option.");
  if (category === null && account === null && review === "keep")
    throw Error("Choose at least one field to change.");
  const splitMap = new Map();
  for (const row of state.transactionSplits || []) {
    if (!splitMap.has(row.transaction)) splitMap.set(row.transaction, []);
    splitMap.get(row.transaction).push(row);
  }
  let allocationChanges = 0,
    skippedCategories = 0;
  const afterSplits = (state.transactionSplits || []).map((s) => {
    if (
      category !== null &&
      includeSplits &&
      selected.has(s.transaction) &&
      s.category !== category
    ) {
      allocationChanges++;
      return { ...s, category };
    }
    return s;
  });
  const changes = [];
  const next = {
    ...state,
    transactionSplits: afterSplits,
    transactions: state.transactions.map((t) => {
      if (!selected.has(t.id)) return t;
      const parts = splitMap.get(t.id) || [],
        after = { ...t };
      if (category !== null) {
        if (
          !["expense", "refund"].includes(t.kind) ||
          (parts.length && !includeSplits)
        )
          skippedCategories++;
        else if (!parts.length) after.category = category;
      }
      if (account !== null) after.account = account;
      if (
        review !== "keep" &&
        (review === "needs-review") !==
          needsReview(t, { ...state, transactionSplits: parts })
      ) {
        after.review = review === "needs-review";
        after.source = review === "reviewed" ? "reviewed" : "pending-review";
      }
      const afterParts = parts.map((s) =>
        includeSplits && category !== null ? { ...s, category } : s,
      );
      if (
        review === "reviewed" &&
        afterParts.some((s) => s.category === "uncategorized")
      )
        throw Error(
          "Categorize every split allocation before marking it reviewed.",
        );
      const fields = [];
      const oldCategories = parts.length
          ? parts.map((s) => s.category)
          : [t.category],
        newCategories = afterParts.length
          ? afterParts.map((s) => s.category)
          : [after.category];
      if (JSON.stringify(oldCategories) !== JSON.stringify(newCategories))
        fields.push({
          name: parts.length ? "Allocation categories" : "Category",
          before: [...new Set(oldCategories)]
            .map((id) => categoryLabel(state.categories, id))
            .join(", "),
          after: [...new Set(newCategories)]
            .map((id) => categoryLabel(state.categories, id))
            .join(", "),
        });
      if (after.account !== t.account)
        fields.push({
          name: "Account",
          before:
            state.accounts.find((a) => a.id === t.account)?.name ||
            "No account",
          after:
            state.accounts.find((a) => a.id === after.account)?.name ||
            "No account",
        });
      if (
        after.source !== t.source ||
        after.review !== t.review ||
        needsReview(t, { ...state, transactionSplits: parts }) !==
          needsReview(after, { ...state, transactionSplits: afterParts })
      )
        fields.push({
          name: "Review status",
          before: needsReview(t, { ...state, transactionSplits: parts })
            ? "Needs review"
            : "Reviewed",
          after: needsReview(after, {
            ...state,
            transactionSplits: afterParts,
          })
            ? "Needs review"
            : "Reviewed",
        });
      if (fields.length)
        changes.push({
          id: t.id,
          merchant: t.merchant || t.description,
          date: t.date,
          kind: t.kind,
          amount: t.amount,
          fields,
        });
      return fields.length ? after : t;
    }),
  };
  return {
    next,
    changes,
    selectedCount: ids.length,
    unchanged: ids.length - changes.length,
    allocationChanges,
    skippedCategories,
    splitCount: transactions.filter((t) => splitMap.has(t.id)).length,
  };
}

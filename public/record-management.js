import { merchantKey } from "./money-model.js";

export const accountTypes = [
  ["bank", "Chequing / debit"],
  ["savings", "Savings"],
  ["credit", "Credit card"],
  ["investment", "Investment"],
  ["loan", "Loan"],
  ["cash", "Cash"],
];
export const accountTypeLabel = (type) =>
  accountTypes.find(([id]) => id === type)?.[1] || type;
export const counted = (n, singular, plural = `${singular}s`) =>
  `${n} ${n === 1 ? singular : plural}`;

export function editAccount(state, id, name, type) {
  const account = state.accounts.find((a) => a.id === id);
  if (
    !account ||
    !name.trim() ||
    !accountTypes.some(([value]) => value === type)
  )
    throw Error("Enter a valid account name and type.");
  const resetMapping = (account.type === "credit") !== (type === "credit");
  return {
    ...state,
    accounts: state.accounts.map((a) =>
      a.id === id ? { ...a, name: name.trim(), type } : a,
    ),
    importProfiles: (state.importProfiles || []).filter(
      (p) => !resetMapping || p.account !== id,
    ),
  };
}

export function removeAccount(
  state,
  id,
  { destination = "", deleteRecords = false } = {},
) {
  if (!state.accounts.some((a) => a.id === id))
    throw Error("Account not found.");
  const linked = [...state.transactions, ...state.balances].some(
    (r) => r.account === id,
  );
  if (
    destination &&
    (destination === id || !state.accounts.some((a) => a.id === destination))
  )
    throw Error("Choose a different account for these records.");
  if (linked && !destination && !deleteRecords)
    throw Error("Move the linked records or confirm their deletion.");
  if (destination && state.balances.some((b) => b.account === id)) {
    const debt = (accountId) =>
      ["credit", "loan"].includes(
        state.accounts.find((a) => a.id === accountId).type,
      );
    if (debt(id) !== debt(destination))
      throw Error(
        "Move balance snapshots to an account with the same asset or debt treatment, or delete the linked records explicitly.",
      );
  }
  const keep = (records) =>
    records.flatMap((r) =>
      r.account !== id
        ? [r]
        : destination
          ? [{ ...r, account: destination }]
          : [],
    );
  // A snapshot is unique per account/date. Never silently overwrite either one.
  const balances = keep(state.balances);
  const dates = balances.map((b) => `${b.account}:${b.date}`);
  if (new Set(dates).size !== dates.length)
    throw Error(
      "Both accounts have a balance on the same date. Correct those snapshots before moving records.",
    );
  const transactions = keep(state.transactions);
  const transactionIds = new Set(transactions.map((t) => t.id));
  return {
    ...state,
    accounts: state.accounts.filter((a) => a.id !== id),
    statementCoverage: (state.statementCoverage || []).filter(
      (c) => c.account !== id,
    ),
    transactions,
    transactionSplits: (state.transactionSplits || []).filter((s) =>
      transactionIds.has(s.transaction),
    ),
    balances,
    // Import mappings describe a particular account's statement, so discard them.
    importProfiles: (state.importProfiles || []).filter(
      (p) => p.account !== id,
    ),
  };
}

export function removeCategory(state, id, replacement = "uncategorized") {
  if (id === "uncategorized")
    throw Error("The Uncategorized category cannot be deleted.");
  if (!state.categories.some((c) => c.id === id))
    throw Error("Category not found.");
  if (replacement === id || !state.categories.some((c) => c.id === replacement))
    throw Error("Choose a different category for these records.");
  const promoted = state.categories.filter((c) => c.parentId === id);
  if (
    promoted.some((child) =>
      state.categories.some(
        (c) =>
          c.id !== id &&
          !c.parentId &&
          c.name.trim().toLowerCase() === child.name.trim().toLowerCase(),
      ),
    )
  )
    throw Error(
      "Rename subcategories that share a name with a top-level category before deleting this group.",
    );
  return {
    ...state,
    categories: state.categories
      .filter((c) => c.id !== id)
      .map((c) =>
        c.parentId === id ? { ...c, parentId: "", budgetScope: "separate" } : c,
      ),
    transactions: state.transactions.map((t) =>
      t.category === id
        ? {
            ...t,
            category: ["expense", "refund"].includes(t.kind) ? replacement : "",
            review:
              ["expense", "refund"].includes(t.kind) &&
              replacement === "uncategorized"
                ? true
                : t.review,
          }
        : t,
    ),
    transactionSplits: (state.transactionSplits || []).map((s) =>
      s.category === id ? { ...s, category: replacement } : s,
    ),
    merchantRules: (state.merchantRules || []).map((r) =>
      r.category === id ? { ...r, category: replacement } : r,
    ),
    budgetOverrides: (state.budgetOverrides || []).filter(
      (b) => b.category !== id,
    ),
  };
}

export function forgetMerchantCategory(state, key) {
  return setMerchantCategory(state, key, "uncategorized");
}

export function setMerchantCategory(state, key, category) {
  const selected = state.merchantRules.find((r) => r.key === key);
  if (!selected) throw Error("Merchant rule not found.");
  const name = merchantKey(selected.merchant);
  // An explicit Uncategorized rule opts out of historical-example learning too.
  return {
    ...state,
    merchantRules: state.merchantRules.map((r) =>
      r.key === key || merchantKey(r.merchant) === name
        ? { ...r, category }
        : r,
    ),
  };
}

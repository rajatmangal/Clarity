import { hasSplits } from "./transaction-splits.js";
import {
  extractMerchant,
  merchantKey,
  transactionDetails,
} from "./money-model.js";
export const merchantGroupKey = (t) =>
  merchantKey(transactionDetails(t).merchant);
export function merchantGroups(transactions, state = {}) {
  const groups = new Map();
  for (const raw of transactions) {
    if (
      hasSplits(state, raw) ||
      raw.skip ||
      !["expense", "refund"].includes(raw.kind)
    )
      continue;
    const t = transactionDetails(raw),
      key = merchantGroupKey(t);
    if (!key) continue;
    const g = groups.get(key) || {
      key,
      name: extractMerchant(t.merchant).merchant,
      transactions: [],
    };
    g.transactions.push(t);
    groups.set(key, g);
  }
  return [...groups.values()]
    .map((g) => ({
      ...g,
      category:
        new Set(g.transactions.map((t) => t.category)).size === 1
          ? g.transactions[0].category
          : "mixed",
    }))
    .sort(
      (a, b) =>
        b.transactions.length - a.transactions.length ||
        a.name.localeCompare(b.name),
    );
}
export function applyGroupCategory(transactions, key, category, state = {}) {
  return transactions.map((t) =>
    !hasSplits(state, t) &&
    !t.skip &&
    ["expense", "refund"].includes(t.kind) &&
    merchantGroupKey(t) === key
      ? { ...t, category, review: false, source: "reviewed" }
      : t,
  );
}
export function approvedNames(state, kind) {
  const candidates = state.transactions
    .filter(
      (t) =>
        !hasSplits(state, t) &&
        !t.review &&
        t.category &&
        t.category !== "uncategorized" &&
        (["expense", "refund"].includes(kind)
          ? ["expense", "refund"].includes(t.kind)
          : t.kind === kind),
    )
    .map((t) => ({
      name: extractMerchant(transactionDetails(t).merchant).merchant,
      category: t.category,
    }));
  if (["expense", "refund"].includes(kind))
    for (const r of state.merchantRules || [])
      candidates.push({ name: r.merchant, category: r.category });
  const names = new Map();
  for (const c of candidates) {
    const key = merchantKey(c.name);
    if (!key) continue;
    const old = names.get(key);
    if (!old) names.set(key, { ...c, key, choices: new Set([c.category]) });
    else old.choices.add(c.category);
  }
  if (["expense", "refund"].includes(kind)) {
    const rules = new Map();
    for (const r of state.merchantRules || []) {
      const key = merchantKey(r.merchant);
      if (r.category === "uncategorized") {
        names.delete(key);
        continue;
      }
      const group = rules.get(key) || {
        name: extractMerchant(r.merchant).merchant,
        category: r.category,
        key,
        choices: new Set(),
      };
      group.choices.add(r.category);
      rules.set(key, group);
    }
    for (const [key, group] of rules) names.set(key, group);
    for (const r of state.merchantRules || []) {
      if (r.category === "uncategorized") names.delete(merchantKey(r.merchant));
    }
  }
  return [...names.values()]
    .map((n) => ({
      name: n.name,
      key: n.key,
      category: n.choices.size === 1 ? n.category : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

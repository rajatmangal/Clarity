export const themes = [
  {
    id: "ocean",
    name: "Ocean",
    description: "Coastal blue & clean whites",
    colors: ["#edf6fb", "#387aa1", "#20384a"],
  },
  {
    id: "rose",
    name: "Rose",
    description: "Soft blush & berry",
    colors: ["#fbf1f4", "#a44e70", "#482c39"],
  },
  {
    id: "ember",
    name: "Ember",
    description: "Warm charcoal & amber",
    colors: ["#211c19", "#e4ad76", "#f7eee5"],
  },
  {
    id: "lavender",
    name: "Lavender",
    description: "Soft lilac & warm whites",
    colors: ["#f7f7f5", "#a48bcf", "#28272c"],
  },
  {
    id: "sage",
    name: "Sage",
    description: "Quiet greens & natural light",
    colors: ["#f1f5ef", "#56816a", "#25372f"],
  },
  {
    id: "sand",
    name: "Sand",
    description: "Warm paper & terracotta",
    colors: ["#faf3e8", "#b57453", "#49372c"],
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "Deep navy & soft violet",
    colors: ["#151825", "#b5a1ef", "#edf0fc"],
  },
  {
    id: "graphite",
    name: "Graphite",
    description: "Charcoal & fresh mint",
    colors: ["#191d1d", "#91c9ad", "#edf5f1"],
  },
];
const cities = [
  "North Vancouver",
  "West Vancouver",
  "New Westminster",
  "Richmond Hill",
  "Mississauga",
  "Vancouver",
  "Toronto",
  "Montreal",
  "Montréal",
  "Ottawa",
  "Calgary",
  "Edmonton",
  "Victoria",
  "Burnaby",
  "Richmond",
  "Surrey",
  "Langley",
  "Coquitlam",
  "Winnipeg",
  "Halifax",
  "Quebec",
  "Québec",
  "Seattle",
  "San Francisco",
  "Los Angeles",
  "New York",
  "Chicago",
  "Boston",
  "Portland",
  "London",
  "Paris",
  "Sydney",
  "Melbourne",
  "Mumbai",
  "Bengaluru",
  "Bangalore",
  "Delhi",
  "Hyderabad",
  "Pune",
];
const cityPattern = new RegExp(
  "(?:[ ,]+)(" +
    cities.join("|") +
    ")\\s+(BC|AB|ON|QC|NS|MB|SK|NB|NL|PE|NT|NU|YT|WA|CA|NY|MA|IL|OR|UK|FR|AU|NSW|VIC|IN|KA|MH|DL|TS)(?:\\s+(?:CAN|CANADA|USA|US|INDIA))?$",
  "i",
);
export function extractMerchant(raw) {
  const description = String(raw || "").trim();
  let merchant = description,
    location = "",
    reference = [];
  merchant = merchant.replace(/\*[A-Z0-9-]{6,}/gi, (m) => {
    if (!/\d/.test(m)) return m;
    reference.push(m);
    return " ";
  });
  if (/^COSTCO\b/i.test(merchant))
    merchant = merchant.replace(/\bW\d{2,}\b/gi, (m) => {
      reference.push(m);
      return " ";
    });
  // Remove only clear terminal/reference tokens. Keep meaningful brand digits (7-Eleven, 3M, Forever 21).
  merchant = merchant.replace(
    /\b(?:REF(?:ERENCE)?|AUTH|TXN|TRANSACTION|TERMINAL|STORE)\s*[:#-]?\s*[A-Z0-9-]*\d[A-Z0-9-]*\b/gi,
    (m) => {
      reference.push(m.trim());
      return " ";
    },
  );
  merchant = merchant.replace(/#\s*[A-Z0-9-]*\d[A-Z0-9-]*\b/gi, (m) => {
    reference.push(m.trim());
    return " ";
  });
  merchant = merchant
    .replace(/\b\d{4,}\b/g, (m) => {
      reference.push(m);
      return " ";
    })
    .replace(/\s+/g, " ")
    .trim();
  const city =
    merchant.match(cityPattern) ||
    merchant.match(new RegExp("(?:[ ,]+)(" + cities.join("|") + ")$", "i"));
  if (city) {
    location = city[0].replace(/^[ ,]+/, "").trim();
    merchant = merchant.slice(0, city.index).trim();
    merchant = merchant.replace(/\b0\d{2,}\b/g, (m) => {
      reference.push(m);
      return " ";
    });
  }
  merchant = merchant
    .replace(/^(?:POS PURCHASE|POS|DEBIT PURCHASE|PURCHASE)\s+/i, "")
    .replace(/\s+/g, " ")
    .replace(/^[ *,-]+|[ *,-]+$/g, "")
    .trim();
  if (/^(?:AMZN Mktp CA|Amazon\.ca)$/i.test(merchant)) merchant = "Amazon";
  if (!merchant) merchant = description;
  return { merchant, location, reference: reference.join(" · ") };
}
export const merchantKey = (raw) =>
  extractMerchant(raw)
    .merchant.normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
export function transactionDetails(t) {
  const extracted = extractMerchant(t.description);
  return {
    ...extracted,
    ...t,
    merchant: t.merchant || extracted.merchant,
    location: t.location ?? extracted.location,
    reference: t.reference ?? extracted.reference,
  };
}
export function makeMerchantRule(t) {
  const key = merchantKey(t.description || t.merchant);
  return {
    id: key,
    key,
    merchant: t.merchant || extractMerchant(t.description).merchant,
    category: t.category,
  };
}
export function rememberCategory(state, t) {
  if (
    !["expense", "refund"].includes(t.kind) ||
    !t.category ||
    t.category === "uncategorized"
  )
    return state;
  const rule = makeMerchantRule(t);
  return {
    ...state,
    merchantRules: [
      ...(state.merchantRules || []).filter((r) => r.key !== rule.key),
      rule,
    ],
  };
}
export function applyMerchantLearning(transactions, state) {
  return transactions.map((input) => {
    const t = transactionDetails(input);
    if (
      t.category !== "uncategorized" ||
      !["expense", "refund"].includes(t.kind)
    )
      return t;
    const key = merchantKey(t.description || t.merchant);
    const rules = state.merchantRules || [];
    const exact = rules.find((r) => r.key === key);
    const aliases = rules.filter((r) =>
      [key, merchantKey(t.merchant)].includes(merchantKey(r.merchant)),
    );
    const rule =
      exact ||
      (new Set(aliases.map((r) => r.category)).size === 1 ? aliases[0] : null);
    if (rule && state.categories.some((c) => c.id === rule.category))
      return {
        ...t,
        merchant: rule.merchant,
        category: rule.category,
        source: "learned",
      };
    const examples = state.transactions.filter(
      (x) =>
        !x.review &&
        ["expense", "refund"].includes(x.kind) &&
        x.category &&
        x.category !== "uncategorized" &&
        (merchantKey(x.description || x.merchant) === key ||
          (x.merchant && merchantKey(x.merchant) === merchantKey(t.merchant))),
    );
    const choices = new Set(examples.map((t) => t.category));
    if (choices.size === 1)
      return { ...t, category: examples[0].category, source: "learned" };
    return t;
  });
}
export function categoryLabel(categories, id) {
  const c = categories.find((c) => c.id === id);
  if (!c) return id === "" ? "No category" : "Uncategorized";
  const p = categories.find((x) => x.id === c.parentId);
  return p ? `${p.name} › ${c.name}` : c.name;
}
export function categoryIds(categories, id) {
  if (!id) return [id];
  return [id, ...categories.filter((c) => c.parentId === id).map((c) => c.id)];
}
export function plannedBudget(categories) {
  return categories
    .filter((c) => !c.parentId)
    .reduce((total, c) => {
      const children = categories.filter((x) => x.parentId === c.id);
      return (
        total +
        (c.budgetScope === "combined" && c.budget > 0
          ? c.budget
          : c.budget + children.reduce((s, x) => s + x.budget, 0))
      );
    }, 0);
}
export function upgradeState(state) {
  return {
    ...state,
    theme: state.theme || "lavender",
    displayName: state.displayName || "",
    merchantRules: state.merchantRules || [],
    budgetOverrides: state.budgetOverrides || [],
    chartPreferences: state.chartPreferences || [],
    categories: state.categories.map((c) => ({
      ...c,
      parentId: c.parentId || "",
      budgetScope: c.budgetScope || "separate",
    })),
    transactions: state.transactions.map(transactionDetails),
  };
}

"use client";
import {
  currencyCodes,
  currencyName,
  favouriteCurrencies,
} from "../public/currencies.js";
import { useEffect, useRef, useState } from "react";
import AnalysisPage from "./analysis-page";
import Onboarding from "./onboarding";
import {
  merchantGroups,
  merchantGroupKey,
  applyGroupCategory,
  approvedNames,
} from "../public/merchant-groups.js";
import {
  LayoutDashboard,
  Tags,
  Palette,
  ArrowLeftRight,
  ChartNoAxesCombined,
  Wallet,
  Settings,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  ChevronLeft,
  ChevronRight,
  Upload,
  ArrowRight,
  X,
  Check,
  CheckCheck,
  Sparkles,
  ShieldCheck,
  FolderOpen,
  Search,
  Trash2,
  Pencil,
  RefreshCw,
  Target,
  TrendingUp,
  Info,
  FileSpreadsheet,
  Download,
  Leaf,
  Menu,
  CalendarDays,
  AlertCircle,
  SlidersHorizontal,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  themes,
  extractMerchant,
  merchantKey,
  makeMerchantRule,
  rememberCategory,
  transactionDetails,
  categoryLabel,
  categoryIds,
  plannedBudget,
} from "../public/money-model.js";
import { updateBudgets } from "../public/budgets.js";
import {
  dateModes,
  dateLocales,
  inferDateOrder,
  parseDate,
} from "../public/dates.js";
import {
  mappingDefaults,
  profileFor,
  profileMapping,
  makeProfile,
  restoreMapping,
} from "../public/import-profiles.js";
import {
  parseCSV,
  validDate,
  normalizeCSV,
  summarize,
  needsReview,
  budgetFactor,
  netWorth,
  localCategorize,
  demoState,
  cents,
  kinds,
} from "../public/core.js";
const uid = () => crypto.randomUUID();
const dateString = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const today = () => dateString(new Date());
const monthName = (d) =>
  new Date(d + "T12:00:00").toLocaleDateString("en-CA", {
    month: "long",
    year: "numeric",
  });
const shortDate = (d) =>
  new Date(d + "T12:00:00").toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
  });
const money = (v, currency = "CAD", compact = false) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
    maximumFractionDigits: compact ? 0 : 2,
  }).format((v || 0) / 100);
function Button({ children, variant = "", className = "", ...props }) {
  return (
    <button className={`btn ${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}
function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function Empty({ icon: Icon = Leaf, title, children, action }) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon size={25} />
      </div>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
function Modal({ title, subtitle, children, onClose, wide = false }) {
  const ref = useRef();
  useEffect(() => {
    ref.current.showModal();
  }, []);
  return (
    <dialog ref={ref} onCancel={onClose} className={wide ? "wide" : ""}>
      <div className="dialog-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button
          aria-label="Close dialog"
          className="icon-button"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
const nav = [
  ["Overview", LayoutDashboard],
  ["Analysis", ChartNoAxesCombined],
  ["Transactions", ArrowLeftRight],
  ["Budgets", Target],
  ["Categories", Tags],
  ["Accounts", Wallet],
];
export default function Home() {
  const currentYear = Number(today().slice(0, 4));
  const [data, setData] = useState(null),
    [meta, setMeta] = useState({}),
    [error, setError] = useState(""),
    [page, setPage] = useState("Overview"),
    [modal, setModal] = useState(null),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [demo, setDemo] = useState(null),
    [mobile, setMobile] = useState(false),
    [setupOpen, setSetupOpen] = useState(false);
  const [period, setPeriod] = useState("month"),
    [month, setMonth] = useState(today().slice(0, 7)),
    [year, setYear] = useState(new Date().getFullYear()),
    [custom, setCustom] = useState({
      start: today().slice(0, 7) + "-01",
      end: today(),
    });
  useEffect(() => {
    setTxPage(0);
  }, [month, year, custom.start, custom.end, period]);
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [catFilter, setCatFilter] = useState("all"),
    [txPage, setTxPage] = useState(0);
  const [selectedTransactions, setSelectedTransactions] = useState([]);
  useEffect(() => {
    setSelectedTransactions([]);
  }, [
    search,
    filter,
    catFilter,
    month,
    year,
    custom.start,
    custom.end,
    period,
    page,
    demo,
  ]);
  useEffect(() => {
    setSelectedTransactions([]);
    setTxPage(0);
  }, [data?.transactions]);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const saving = useRef(false);
  useEffect(() => {
    if (!mobile) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const escape = (e) => {
      if (e.key === "Escape") setMobile(false);
    };
    document.addEventListener("keydown", escape);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", escape);
    };
  }, [mobile]);
  const state = demo || data;
  useEffect(() => {
    document.documentElement.dataset.theme = state?.theme || "lavender";
  }, [state?.theme]);
  const notify = (text) => {
    setToast(text);
    setTimeout(() => setToast(""), 5000);
  };
  async function load() {
    try {
      const r = await fetch("/api/state");
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setData(d.state);
      setMeta(d);
      if (d.keyConfigured) {
        fetch("/api/models")
          .then((r) => r.json())
          .then((result) => setMeta((m) => ({ ...m, ...result })))
          .catch(() =>
            setMeta((m) => ({
              ...m,
              models: [],
              modelError: "Could not check available models.",
            })),
          );
      }
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function api(path, body, method = "POST") {
    const r = await fetch("/api/" + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Clarity-Token": meta.token,
      },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (!r.ok) throw Error(d.error);
    return d;
  }
  async function save(next, message = "Saved to your Markdown vault", onError) {
    if (demo) {
      notify("Exit sample mode to save your own data.");
      return false;
    }
    if (saving.current) return false;
    saving.current = true;
    setBusy(true);
    try {
      const result = await api(
        "state",
        { state: next, revision: meta.revision },
        "PUT",
      );
      setData(result.state);
      setMeta((m) => ({ ...m, revision: result.revision }));
      notify(message);
      return true;
    } catch (e) {
      notify(e.message);
      onError?.(e.message);
      return false;
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  const fmt = (v) => money(v, state?.currency);
  let start, end;
  if (period === "month") {
    start = month + "-01";
    const [y, m] = month.split("-").map(Number);
    end = dateString(new Date(y, m, 0));
  } else if (period === "year") {
    start = `${year}-01-01`;
    end = `${year}-12-31`;
  } else {
    start = custom.start;
    end = custom.end;
  }
  const validRange =
    start &&
    end &&
    start <= end &&
    (new Date(end) - new Date(start)) / 864e5 <= 3660;
  const summary = state && validRange ? summarize(state, start, end) : null;
  const factor = validRange ? budgetFactor(start, end) : 0;
  const periodLabel =
    period === "month"
      ? monthName(start)
      : period === "year"
        ? String(year)
        : `${shortDate(start || today())} – ${shortDate(end || today())}`;
  function moveMonth(n) {
    const [y, m] = month.split("-").map(Number);
    setMonth(dateString(new Date(y, m - 1 + n, 1)).slice(0, 7));
  }
  function close() {
    setModal(null);
  }
  if (!data)
    return (
      <div className="boot">
        <img
          className="clarity-mark"
          src="/brand/clarity.svg"
          alt="Clarity"
          width="48"
          height="48"
        />
        <h2>
          {error
            ? "Could not open your ledger"
            : "A little clarity is on its way."}
        </h2>
        <p>{error || "Loading your local money journal…"}</p>
        {error && (
          <Button onClick={load}>
            <RefreshCw size={16} />
            Try again
          </Button>
        )}
      </div>
    );
  if (!demo && (!data.onboardingCompleted || setupOpen))
    return (
      <Onboarding
        state={data}
        meta={meta}
        api={api}
        onCancel={data.onboardingCompleted ? () => setSetupOpen(false) : null}
        onFinish={async (preferences, vaultPath) => {
          let revision = meta.revision;
          if (vaultPath.trim() !== meta.vaultPath) {
            const moved = await api("vault", {
              path: vaultPath.trim(),
              revision,
            });
            revision = moved.revision;
            setMeta((m) => ({ ...m, ...moved }));
            if (moved.cleanupWarning) notify(moved.cleanupWarning);
          }
          const result = await api(
            "state",
            {
              state: { ...data, ...preferences, onboardingCompleted: true },
              revision,
            },
            "PUT",
          );
          setData(result.state);
          setMeta((m) => ({ ...m, revision: result.revision }));
          setSetupOpen(false);
          notify(
            "Your journal is ready. Add an account or import your first statement.",
          );
        }}
      />
    );
  const budget = summary?.budgetTotal || 0;
  const aiReady =
    !!meta.keyConfigured &&
    !!meta.models?.some((m) => m.id === state.model) &&
    !demo;
  const worth = netWorth(state, end || today());
  const priorDate = new Date((start || today()) + "T12:00:00");
  priorDate.setDate(priorDate.getDate() - 1);
  const priorWorth = netWorth(state, dateString(priorDate));
  const worthCaption = worth.missing
    ? `${worth.missing} accounts missing balances`
    : priorWorth.missing === 0 && state.accounts.length
      ? `${worth.total - priorWorth.total >= 0 ? "+" : ""}${fmt(worth.total - priorWorth.total)} since start of range`
      : "Record earlier snapshots to compare progress";
  const filtered = (summary?.tx || [])
    .filter(
      (t) =>
        (filter === "all" || filter === "review"
          ? filter !== "review" || needsReview(t)
          : t.kind === filter) &&
        (catFilter === "all" ||
          categoryIds(state.categories, catFilter).includes(t.category)) &&
        ([t.description, t.merchant, t.location, t.reference]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase()) ||
          state.accounts
            .find((a) => a.id === t.account)
            ?.name.toLowerCase()
            .includes(search.toLowerCase())),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  function jumpCategory(id) {
    setCatFilter(id);
    setFilter("all");
    setPage("Transactions");
    setTxPage(0);
  }
  const currentTitle = {
    Overview: "See your spending. Plan your saving.",
    Analysis: "See the patterns. Choose your next move.",
    Transactions: "Every little thing adds up.",
    Budgets: "Make room for what matters.",
    Categories: "A place for every purchase.",
    Accounts: "See how far you’ve come.",
    Settings: "A space that’s yours.",
  }[page];
  return (
    <div className="shell">
      {mobile && (
        <button
          className="mobile-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={mobile ? "sidebar open" : "sidebar"}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("Overview");
          }}
        >
          <img className="clarity-mark" src="/brand/clarity.svg" alt="" />
          clarity
          <span className="brand-dot">.</span>
        </a>
        <div className="workspace">
          <span className="avatar">
            {state?.displayName?.trim().slice(0, 1).toUpperCase() || "C"}
          </span>
          <div>
            {state?.displayName
              ? `${state.displayName}’s journal`
              : "My money journal"}
            <small>Personal workspace</small>
          </div>
          <span className="local-dot" />
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav>
          {nav.map(([label, Icon]) => (
            <button
              key={label}
              className={page === label ? "active" : ""}
              onClick={() => {
                setPage(label);
                setMobile(false);
              }}
            >
              <Icon size={19} />
              {label}
              {label === "Transactions" && summary?.review > 0 && (
                <span className="count">{summary.review}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-card">
            <ShieldCheck size={21} />
            <strong>Yours. And only yours.</strong>
            <p>
              Saved locally. No bank logins.
              <br />A little more peace of mind.
            </p>
            <span>
              <i />
              Markdown vault connected
            </span>
          </div>
          <button
            className={`settings-nav ${page === "Settings" ? "active" : ""}`}
            onClick={() => {
              setPage("Settings");
              setMobile(false);
            }}
          >
            <Settings size={19} />
            Settings
          </button>
          <div className="sidebar-foot">
            MADE FOR A CLEARER TOMORROW <Leaf size={12} />
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-toggle"
              aria-label="Toggle menu"
              aria-expanded={mobile}
              onClick={() => setMobile(!mobile)}
            >
              <Menu size={20} />
            </button>
            <span>My workspace</span>
            <ChevronRight size={14} />
            <b>{page}</b>
          </div>
          <div className="top-actions">
            <span className="privacy">
              <i /> Local & private
            </span>
            <button
              className="icon-button"
              title="Reload from Markdown vault"
              aria-label="Reload from Markdown vault"
              onClick={async () => {
                await load();
                notify("Reloaded your Markdown ledger");
              }}
            >
              <RefreshCw size={16} />
            </button>
            <span className="avatar small">
              {state?.displayName?.trim().slice(0, 1).toUpperCase() || "C"}
            </span>
          </div>
        </header>
        <div className="content">
          {demo && (
            <div className="demo-banner">
              <Sparkles size={16} />
              <span>
                Sample workspace · These numbers are fictional and never saved
                to your vault.
              </span>
              <button
                onClick={() => {
                  setDemo(null);
                  setPage("Overview");
                }}
              >
                Exit sample <X size={14} />
              </button>
            </div>
          )}
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {page === "Overview"
                  ? "A LITTLE CLARITY, EVERY DAY"
                  : `YOUR MONEY / ${page.toUpperCase()}`}
              </div>
              <h1>{currentTitle}</h1>
              <p>
                {page === "Overview"
                  ? "Know where it goes. Decide where you grow."
                  : page === "Analysis"
                    ? "Compare months, understand your merchants, and make this view your own."
                    : page === "Transactions"
                      ? "One clear view of your spending, income, and everything in between."
                      : page === "Budgets"
                        ? "Thoughtful limits, with plenty of room to live."
                        : page === "Accounts"
                          ? "Record your balances and follow your progress over time."
                          : page === "Categories"
                            ? "Organize merchants, group your spending, and set limits that fit."
                            : "Your appearance, preferences, and local files."}
              </p>
            </div>
            {!["Settings", "Categories"].includes(page) && (
              <Button
                variant="primary"
                disabled={!!demo}
                onClick={() => setModal("import")}
              >
                <Plus size={17} />
                Import statement
              </Button>
            )}
          </div>
          {!["Settings", "Categories"].includes(page) && (
            <div className="period-toolbar">
              <div className="segmented">
                {[
                  ["month", "Monthly"],
                  ["year", "Yearly"],
                  ["custom", "Custom range"],
                ].map(([v, l]) => (
                  <button
                    key={v}
                    className={period === v ? "selected" : ""}
                    onClick={() => {
                      setPeriod(v);
                      setTxPage(0);
                    }}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <div className="period-picker">
                {period === "month" ? (
                  <>
                    <button
                      className="icon-button"
                      aria-label="Previous month"
                      onClick={() => moveMonth(-1)}
                    >
                      <ChevronLeft size={17} />
                    </button>
                    <CalendarDays size={16} />
                    <input
                      aria-label="Selected month"
                      type="month"
                      value={month}
                      onChange={(e) => {
                        if (e.target.value) setMonth(e.target.value);
                      }}
                    />
                    <button
                      className="icon-button"
                      aria-label="Next month"
                      onClick={() => moveMonth(1)}
                    >
                      <ChevronRight size={17} />
                    </button>
                  </>
                ) : period === "year" ? (
                  <>
                    <CalendarDays size={16} />
                    <select
                      aria-label="Selected year"
                      value={year}
                      onChange={(e) => setYear(Number(e.target.value))}
                    >
                      {Array.from(
                        { length: 121 },
                        (_, i) => currentYear - 20 + i,
                      ).map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                    {year !== currentYear && (
                      <Button
                        className="current-year-button"
                        onClick={() => setYear(currentYear)}
                      >
                        Current year
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <input
                      aria-label="Start date"
                      type="date"
                      value={custom.start}
                      onChange={(e) =>
                        setCustom({ ...custom, start: e.target.value })
                      }
                    />
                    <span>to</span>
                    <input
                      aria-label="End date"
                      type="date"
                      value={custom.end}
                      onChange={(e) =>
                        setCustom({ ...custom, end: e.target.value })
                      }
                    />
                  </>
                )}
              </div>
            </div>
          )}
          {!validRange && !["Settings", "Categories"].includes(page) ? (
            <div className="notice danger">
              Choose a valid date range of up to ten years.
            </div>
          ) : (
            <>
              {page === "Overview" && (
                <>
                  <button
                    className="quick-add-toggle"
                    aria-expanded={quickAddOpen}
                    aria-controls="quick-add-actions"
                    onClick={() => setQuickAddOpen(!quickAddOpen)}
                  >
                    <Plus size={17} /> Add something{" "}
                    <span>{quickAddOpen ? "Hide" : "Show"}</span>
                  </button>
                  <div
                    id="quick-add-actions"
                    className={`quick-add ${quickAddOpen ? "expanded" : ""}`}
                    aria-label="Quick add"
                  >
                    <span>ADD SOMETHING</span>
                    {[
                      ["expense", "Expense"],
                      ["income", "Income"],
                      ["refund", "Refund"],
                      ["transfer", "Transfer"],
                    ].map(([kind, label]) => (
                      <Button
                        key={kind}
                        disabled={
                          !!demo ||
                          (kind === "expense" && !state.accounts.length)
                        }
                        title={
                          kind === "expense" && !state.accounts.length
                            ? "Add an account first"
                            : undefined
                        }
                        onClick={() =>
                          setModal({ type: "transaction", initialKind: kind })
                        }
                      >
                        <Plus size={14} />
                        {label}
                      </Button>
                    ))}
                    <Button
                      disabled={!!demo}
                      onClick={() => setModal({ type: "account" })}
                    >
                      <Wallet size={14} />
                      Account
                    </Button>
                    <Button
                      disabled={!!demo || !state.accounts.length}
                      onClick={() => setModal({ type: "balance" })}
                    >
                      <TrendingUp size={14} />
                      Balance
                    </Button>
                    <Button
                      disabled={!!demo}
                      onClick={() => setModal({ type: "category" })}
                    >
                      <Tags size={14} />
                      Category / subcategory
                    </Button>
                    <Button
                      disabled={!!demo}
                      onClick={() => setModal({ type: "budget" })}
                    >
                      <Target size={14} />
                      Budget
                    </Button>
                    <Button
                      disabled={!!demo}
                      onClick={() => setModal({ type: "override" })}
                    >
                      <CalendarDays size={14} />
                      Month adjustment
                    </Button>
                  </div>
                  {!state.transactions.length && (
                    <div className="welcome-banner">
                      <div className="welcome-symbol">
                        <Leaf size={28} />
                      </div>
                      <div>
                        <h3>A fresh start for your finances.</h3>
                        <p>
                          Import your first statement, or take a look around
                          with sample data.
                        </p>
                      </div>
                      <Button onClick={() => setDemo(demoState())}>
                        Explore sample <ArrowUpRight size={16} />
                      </Button>
                    </div>
                  )}
                  <div className="metrics">
                    <Metric
                      label="Total spending"
                      value={fmt(summary.spending)}
                      caption={`${summary.tx.filter((t) => t.kind === "expense").length} purchases · refunds deducted`}
                      icon={ArrowUpRight}
                    />
                    <Metric
                      label="Money in"
                      value={fmt(summary.income)}
                      caption="Income only · transfers excluded"
                      icon={ArrowDownRight}
                    />
                    <Metric
                      label="Left after spending"
                      value={fmt(summary.net)}
                      caption={
                        summary.income
                          ? `${Math.round((summary.net / summary.income) * 100)}% of recorded income retained`
                          : "Import income for a complete picture"
                      }
                      icon={Leaf}
                      accent
                    />
                    <Metric
                      label="Tracked net worth"
                      value={state.balances.length ? fmt(worth.total) : "—"}
                      caption={
                        worth.missing
                          ? `${worth.missing} account${worth.missing === 1 ? "" : "s"} missing a balance`
                          : `Latest balances on or before ${shortDate(end)}`
                      }
                      icon={Wallet}
                    />
                  </div>
                  <div className="charts-grid">
                    <section className="panel trend-panel">
                      <PanelTitle
                        title="The bigger picture"
                        subtitle={`Income and spending · ${periodLabel}`}
                        right={<span className="chip">{state.currency}</span>}
                      />
                      <CashChart state={state} start={start} end={end} />
                    </section>
                    <section className="panel">
                      <PanelTitle
                        title="Where it went"
                        subtitle="Your spending, broken down"
                      />
                      {summary.spending > 0 ? (
                        <>
                          <div className="donut-wrap">
                            <ResponsiveContainer width="100%" height={195}>
                              <PieChart>
                                <Pie
                                  data={summary.categories.filter(
                                    (c) => c.spent > 0,
                                  )}
                                  dataKey="spent"
                                  nameKey="name"
                                  innerRadius={67}
                                  outerRadius={87}
                                  paddingAngle={3}
                                  stroke="none"
                                >
                                  {summary.categories
                                    .filter((c) => c.spent > 0)
                                    .map((c) => (
                                      <Cell key={c.id} fill={c.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                  {...chartTooltip}
                                  formatter={(v) => fmt(v)}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                            <div className="donut-label">
                              <small>NET SPENDING</small>
                              <strong>{fmt(summary.spending)}</strong>
                            </div>
                          </div>
                          <div className="legend-list">
                            {summary.categories
                              .filter((c) => c.spent > 0)
                              .slice(0, 4)
                              .map((c) => (
                                <button
                                  key={c.id}
                                  onClick={() => jumpCategory(c.id)}
                                >
                                  <span>
                                    <i style={{ background: c.color }} />
                                    {c.name}
                                  </span>
                                  <strong>{fmt(c.spent)}</strong>
                                </button>
                              ))}
                          </div>
                          <button
                            className="text-button full"
                            onClick={() => setPage("Categories")}
                          >
                            View all categories <ArrowRight size={15} />
                          </button>
                        </>
                      ) : (
                        <Empty
                          title={
                            summary.tx.length
                              ? "Refunds offset spending in this range"
                              : "Your spending story starts here"
                          }
                        >
                          {summary.tx.length
                            ? "Review transactions to compare purchases and refunds."
                            : "Add purchases to see your category breakdown."}
                        </Empty>
                      )}
                    </section>
                  </div>
                  <div className="section-heading">
                    <h2>
                      A few things worth noticing <Sparkles size={17} />
                    </h2>
                    <span>Grounded in your numbers</span>
                  </div>
                  <Insights
                    summary={summary}
                    state={state}
                    factor={factor}
                    fmt={fmt}
                    onReview={() => {
                      setFilter("review");
                      setCatFilter("all");
                      setPage("Transactions");
                    }}
                    onBudget={() => setPage("Budgets")}
                  />
                  <div className="bottom-grid">
                    <section className="panel">
                      <PanelTitle
                        title="Your budget, at a glance"
                        subtitle={
                          budget
                            ? `${fmt(budget)} planned for this range`
                            : "Give your spending a little direction"
                        }
                        right={
                          <button
                            className="text-button"
                            onClick={() => setPage("Budgets")}
                          >
                            Manage <ArrowUpRight size={15} />
                          </button>
                        }
                      />
                      {summary.categories.some((c) => c.targetBudget > 0) ? (
                        <div className="budget-list">
                          {summary.categories
                            .filter((c) => (c.targetBudget ?? c.budget) > 0)
                            .slice(0, 4)
                            .map((c) => (
                              <BudgetRow
                                key={c.id}
                                category={c}
                                factor={factor}
                                fmt={fmt}
                              />
                            ))}
                        </div>
                      ) : (
                        <Empty
                          icon={Target}
                          title="A plan that fits your life"
                          action={
                            <Button onClick={() => setPage("Budgets")}>
                              Set a monthly budget <ArrowRight size={14} />
                            </Button>
                          }
                        >
                          Start with a few categories. You can adjust them
                          anytime.
                        </Empty>
                      )}
                    </section>
                    <section className="panel">
                      <PanelTitle
                        title="Recent activity"
                        subtitle="The small details behind the big picture"
                        right={
                          <button
                            className="text-button"
                            onClick={() => setPage("Transactions")}
                          >
                            View all <ArrowUpRight size={15} />
                          </button>
                        }
                      />
                      {summary.tx.length ? (
                        <div className="recent-list">
                          {[...summary.tx]
                            .sort((a, b) => b.date.localeCompare(a.date))
                            .slice(0, 5)
                            .map((t) => (
                              <div key={t.id}>
                                <span
                                  className="merchant-icon"
                                  style={{
                                    background: state.categories.find(
                                      (c) => c.id === t.category,
                                    )?.color
                                      ? state.categories.find(
                                          (c) => c.id === t.category,
                                        ).color + "22"
                                      : "var(--chart-hover)",
                                  }}
                                >
                                  {(t.merchant || t.description).charAt(0)}
                                </span>
                                <div>
                                  <strong>
                                    {t.merchant ||
                                      extractMerchant(t.description).merchant}
                                  </strong>
                                  <details className="statement-details">
                                    <summary>Statement details</summary>
                                    <p>{t.description}</p>
                                    {t.location && (
                                      <p>Location: {t.location}</p>
                                    )}
                                    {t.reference && (
                                      <p>Reference: {t.reference}</p>
                                    )}
                                  </details>
                                  <small>
                                    {shortDate(t.date)} ·{" "}
                                    {state.categories.find(
                                      (c) => c.id === t.category,
                                    )?.name || "No category"}
                                  </small>
                                </div>
                                <b
                                  className={
                                    t.kind === "income" || t.kind === "refund"
                                      ? "positive"
                                      : ""
                                  }
                                >
                                  {["income", "refund"].includes(t.kind)
                                    ? "+"
                                    : t.kind === "expense"
                                      ? "−"
                                      : ""}
                                  {fmt(t.amount)}
                                </b>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <Empty
                          icon={ArrowLeftRight}
                          title="Nothing here just yet"
                        >
                          Your imported transactions will appear here.
                        </Empty>
                      )}
                    </section>
                  </div>
                  <p className="footnote">
                    <ShieldCheck size={13} /> Based on imported records.
                    Transfers are excluded; balance snapshots are tracked
                    separately.{" "}
                    {end >= today() && "Current periods may be incomplete."}
                  </p>
                </>
              )}
              {page === "Transactions" && (
                <section className="panel">
                  <PanelTitle
                    title="Your transactions"
                    subtitle={`${filtered.length} matching records · ${periodLabel}`}
                    right={
                      <div className="transaction-actions">
                        <Button
                          disabled={!!demo || !filtered.length}
                          onClick={() => setModal({ type: "merchant-groups" })}
                        >
                          <Tags size={15} />
                          Categorize merchants
                        </Button>
                        <Button
                          disabled={!!demo}
                          onClick={() => setModal({ type: "transaction" })}
                        >
                          <Plus size={15} />
                          Add transaction
                        </Button>
                      </div>
                    }
                  />
                  <div className="filters">
                    <div className="search">
                      <Search size={16} />
                      <input
                        aria-label="Search transactions"
                        placeholder="Search a merchant or account…"
                        value={search}
                        onChange={(e) => {
                          setSearch(e.target.value);
                          setTxPage(0);
                        }}
                      />
                    </div>
                    <select
                      aria-label="Transaction type"
                      value={filter}
                      onChange={(e) => {
                        setFilter(e.target.value);
                        setTxPage(0);
                      }}
                    >
                      <option value="all">All transaction types</option>
                      <option value="review">Needs review</option>
                      {kinds.map((k) => (
                        <option key={k}>{k}</option>
                      ))}
                    </select>
                    <select
                      aria-label="Filter category"
                      value={catFilter}
                      onChange={(e) => {
                        setCatFilter(e.target.value);
                        setTxPage(0);
                      }}
                    >
                      <option value="all">All categories</option>
                      <option value="">No category</option>
                      {state.categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {categoryLabel(state.categories, c.id)}
                        </option>
                      ))}
                    </select>
                  </div>
                  {filtered.length ? (
                    <>
                      <div className="transaction-selection">
                        <label className="check-row">
                          <input
                            type="checkbox"
                            disabled={!!demo || busy}
                            checked={filtered.every((t) =>
                              selectedTransactions.includes(t.id),
                            )}
                            onChange={(e) =>
                              setSelectedTransactions(
                                e.target.checked
                                  ? filtered.map((t) => t.id)
                                  : [],
                              )
                            }
                          />
                          Select all {filtered.length} matching transactions
                        </label>
                        <span>{selectedTransactions.length} selected</span>
                        {selectedTransactions.length > 0 && (
                          <>
                            <Button
                              disabled={busy}
                              onClick={() => setSelectedTransactions([])}
                            >
                              Clear
                            </Button>
                            <Button
                              variant="danger-button"
                              disabled={busy || !!demo}
                              onClick={() =>
                                setModal({
                                  type: "delete-transactions",
                                  ids: selectedTransactions,
                                })
                              }
                            >
                              <Trash2 size={15} />
                              Delete selected
                            </Button>
                          </>
                        )}
                      </div>
                      <div className="table-scroll">
                        <table className="transaction-table">
                          <thead>
                            <tr>
                              <th aria-label="Select transactions">Select</th>
                              <th>Date</th>
                              <th>Description</th>
                              <th>Category</th>
                              <th>Account</th>
                              <th>Type</th>
                              <th className="align-right">Amount</th>
                              <th>Review</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filtered
                              .slice(txPage * 25, txPage * 25 + 25)
                              .map((t) => (
                                <tr key={t.id}>
                                  <td className="transaction-select">
                                    {" "}
                                    <input
                                      type="checkbox"
                                      aria-label={`Select ${t.merchant || t.description} on ${t.date}`}
                                      disabled={!!demo || busy}
                                      checked={selectedTransactions.includes(
                                        t.id,
                                      )}
                                      onChange={(e) =>
                                        setSelectedTransactions((ids) =>
                                          e.target.checked
                                            ? [...ids, t.id]
                                            : ids.filter((id) => id !== t.id),
                                        )
                                      }
                                    />
                                  </td>
                                  <td>
                                    {shortDate(t.date)}
                                    <small>{t.date.slice(0, 4)}</small>
                                  </td>
                                  <td>
                                    <button
                                      className="transaction-link"
                                      disabled={!!demo}
                                      onClick={() =>
                                        setModal({
                                          type: "transaction",
                                          transaction: t,
                                        })
                                      }
                                    >
                                      {t.merchant ||
                                        extractMerchant(t.description).merchant}
                                    </button>
                                  </td>
                                  <td>
                                    <span className="category-tag">
                                      <i
                                        style={{
                                          background: state.categories.find(
                                            (c) => c.id === t.category,
                                          )?.color,
                                        }}
                                      />
                                      {state.categories.find(
                                        (c) => c.id === t.category,
                                      )?.name || "No category"}
                                    </span>
                                  </td>
                                  <td>
                                    {state.accounts.find(
                                      (a) => a.id === t.account,
                                    )?.name || "No account"}
                                  </td>
                                  <td>
                                    <span className={`type ${t.kind}`}>
                                      {t.kind}
                                    </span>
                                  </td>
                                  <td className="align-right number">
                                    {fmt(t.amount)}
                                  </td>
                                  <td>
                                    {needsReview(t) ? (
                                      <button
                                        className="review-pill"
                                        disabled={!!demo}
                                        onClick={() =>
                                          setModal({
                                            type: "transaction",
                                            transaction: t,
                                          })
                                        }
                                      >
                                        Review
                                      </button>
                                    ) : (
                                      <Check size={16} className="muted" />
                                    )}
                                  </td>
                                  <td className="transaction-row-actions">
                                    <button
                                      aria-label={`Edit ${t.merchant || t.description} on ${t.date}`}
                                      title="Edit transaction"
                                      className="icon-button"
                                      disabled={!!demo || busy}
                                      onClick={() =>
                                        setModal({
                                          type: "transaction",
                                          transaction: t,
                                        })
                                      }
                                    >
                                      <Pencil size={16} />
                                    </button>
                                    <button
                                      className="icon-button"
                                      disabled={!!demo || busy}
                                      aria-label={`Delete ${t.merchant || t.description} on ${t.date}`}
                                      onClick={() =>
                                        setModal({
                                          type: "delete-transactions",
                                          ids: [t.id],
                                        })
                                      }
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="pagination">
                        <span>
                          Showing {Math.min(txPage * 25 + 1, filtered.length)}–
                          {Math.min(txPage * 25 + 25, filtered.length)} of{" "}
                          {filtered.length}
                        </span>
                        <Button
                          disabled={txPage === 0}
                          onClick={() => setTxPage(txPage - 1)}
                        >
                          <ChevronLeft size={15} />
                        </Button>
                        <Button
                          disabled={(txPage + 1) * 25 >= filtered.length}
                          onClick={() => setTxPage(txPage + 1)}
                        >
                          <ChevronRight size={15} />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <Empty icon={Search} title="No transactions in this view">
                      Try another date range or clear your filters.
                    </Empty>
                  )}
                </section>
              )}
              {page === "Analysis" && (
                <AnalysisPage
                  state={state}
                  start={start}
                  end={end}
                  save={save}
                  busy={busy}
                  demo={demo}
                />
              )}
              {page === "Categories" && (
                <CategoriesPage
                  state={state}
                  demo={demo}
                  busy={busy}
                  save={save}
                  open={setModal}
                  fmt={fmt}
                />
              )}
              {page === "Budgets" && (
                <>
                  <div className="budget-intro">
                    <div>
                      <span className="eyebrow">SPENDING PLAN</span>
                      <h2>
                        {fmt(summary.spending)}{" "}
                        <span>of {fmt(budget)} planned</span>
                      </h2>
                      <p>
                        Combined limits cover a whole group. Separate limits
                        cover direct category spending. Child targets inside a
                        combined limit do not add to your overall plan.
                      </p>
                    </div>
                    <Button
                      disabled={!!demo}
                      onClick={() => setModal({ type: "budget" })}
                    >
                      <Target size={16} />
                      Edit budgets
                    </Button>
                    <Button
                      disabled={!!demo}
                      onClick={() => setModal({ type: "override" })}
                    >
                      Adjust one month
                    </Button>
                  </div>
                  {(state.budgetOverrides || []).some(
                    (o) =>
                      o.month >= start.slice(0, 7) &&
                      o.month <= end.slice(0, 7),
                  ) && (
                    <p className="notice">
                      This range includes temporary monthly limits. Your usual
                      plan is unchanged. Open “Adjust one month” to review or
                      restore them.
                    </p>
                  )}
                  <div className="budget-cards">
                    {summary.categories
                      .filter((c) => (c.targetBudget ?? c.budget) > 0)
                      .map((c) => (
                        <section className="panel budget-card" key={c.id}>
                          <div className="budget-card-heading">
                            <span
                              className="category-icon"
                              style={{
                                background: c.color + "25",
                                color: c.color,
                              }}
                            >
                              <Target size={20} />
                            </span>
                            <h3>{categoryLabel(state.categories, c.id)}</h3>
                            <button
                              className="icon-button"
                              aria-label={`Edit ${c.name} budget`}
                              disabled={!!demo}
                              onClick={() =>
                                setModal({ type: "category", category: c })
                              }
                            >
                              <SlidersHorizontal size={16} />
                            </button>
                          </div>
                          <p className="form-note">
                            {c.budgetScope === "combined"
                              ? "Combined limit · includes subcategories"
                              : c.parentId &&
                                  state.categories.find(
                                    (p) => p.id === c.parentId,
                                  )?.budgetScope === "combined"
                                ? "Child target · inside the parent limit"
                                : "Separate limit · direct spending"}
                          </p>
                          <BudgetRow
                            category={c}
                            factor={factor}
                            fmt={fmt}
                            hideTitle
                          />
                          <button
                            className="text-button"
                            onClick={() => jumpCategory(c.id)}
                          >
                            View transactions <ArrowRight size={14} />
                          </button>
                        </section>
                      ))}
                  </div>
                  {!summary.categories.some((c) => c.targetBudget > 0) && (
                    <Empty
                      icon={Target}
                      title="Create your spending plan"
                      action={
                        <Button
                          disabled={!!demo}
                          onClick={() => setModal({ type: "budget" })}
                        >
                          Add a budget
                        </Button>
                      }
                    >
                      Set a combined category limit or individual subcategory
                      limits.
                    </Empty>
                  )}
                  <p className="footnote">
                    Limits are prorated by calendar days. Regular limits reflect
                    your current plan; monthly adjustments apply only to their
                    chosen month.
                  </p>
                </>
              )}
              {page === "Accounts" && (
                <>
                  <div className="metrics three">
                    <Metric
                      label="Tracked net worth"
                      value={state.balances.length ? fmt(worth.total) : "—"}
                      caption={worthCaption}
                      icon={Wallet}
                      accent
                    />
                    <Metric
                      label="Assets"
                      value={fmt(
                        worth.accounts
                          .filter((a) => !["credit", "loan"].includes(a.type))
                          .reduce((s, a) => s + (a.balance || 0), 0),
                      )}
                      caption="Latest recorded asset balances"
                      icon={TrendingUp}
                    />
                    <Metric
                      label="Liabilities"
                      value={fmt(
                        worth.accounts
                          .filter((a) => ["credit", "loan"].includes(a.type))
                          .reduce((s, a) => s + (a.balance || 0), 0),
                      )}
                      caption="Credit cards and loans owed"
                      icon={ArrowUpRight}
                    />
                  </div>
                  <section className="panel">
                    <PanelTitle
                      title="Building your tomorrow"
                      subtitle="Month-end view · last known balance carried forward"
                      right={
                        <Button
                          disabled={!!demo || !state.accounts.length}
                          onClick={() => setModal({ type: "balance" })}
                        >
                          <Plus size={15} />
                          Record balance
                        </Button>
                      }
                    />
                    <WorthChart state={state} start={start} end={end} />
                  </section>
                  <div className="section-heading">
                    <h2>Your accounts</h2>
                    <Button
                      disabled={!!demo}
                      onClick={() => setModal({ type: "account" })}
                    >
                      <Plus size={16} />
                      Add account
                    </Button>
                  </div>
                  <div className="account-cards">
                    {worth.accounts.map((a) => (
                      <section className="panel account-card" key={a.id}>
                        <div>
                          <span className="category-icon">
                            <Wallet size={20} />
                          </span>
                          <span className="chip">{a.type}</span>
                        </div>
                        <h3>{a.name}</h3>
                        <h2>{a.balance === null ? "—" : fmt(a.balance)}</h2>
                        <p>
                          {a.date
                            ? `Last recorded ${a.date}`
                            : "No balance recorded for this period"}
                        </p>
                        {a.date &&
                          (new Date(end) - new Date(a.date)) / 864e5 > 35 && (
                            <span className="review-pill">
                              Balance is more than 35 days old
                            </span>
                          )}
                        <Button
                          disabled={!!demo}
                          onClick={() =>
                            setModal({ type: "balance", account: a.id })
                          }
                        >
                          Update balance <ArrowUpRight size={15} />
                        </Button>
                        {profileFor(state, a.id) && (
                          <button
                            className="text-button"
                            style={{ marginTop: 16 }}
                            disabled={!!demo}
                            onClick={() =>
                              setModal({
                                type: "import",
                                account: a.id,
                                editOnly: true,
                              })
                            }
                          >
                            <SlidersHorizontal size={14} />
                            Edit import settings
                          </button>
                        )}
                      </section>
                    ))}
                  </div>
                  {!state.accounts.length && (
                    <Empty
                      icon={Wallet}
                      title="Give your money a home"
                      action={
                        <Button onClick={() => setModal({ type: "account" })}>
                          Add your first account
                        </Button>
                      }
                    >
                      Add chequing, savings, investments, credit cards, and
                      loans.
                    </Empty>
                  )}
                  {state.balances.length > 0 && (
                    <section className="panel">
                      <PanelTitle
                        title="Balance journal"
                        subtitle="Snapshots you recorded · select a record to correct it"
                      />
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Account</th>
                              <th className="align-right">Balance</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {state.balances
                              .filter((b) => b.date >= start && b.date <= end)
                              .sort((a, b) => b.date.localeCompare(a.date))
                              .map((b) => (
                                <tr key={b.id}>
                                  <td>{b.date}</td>
                                  <td>
                                    {state.accounts.find(
                                      (a) => a.id === b.account,
                                    )?.name || "No account"}
                                  </td>
                                  <td className="align-right">
                                    {fmt(b.amount)}
                                  </td>
                                  <td>
                                    <button
                                      className="text-button"
                                      disabled={!!demo}
                                      onClick={() =>
                                        setModal({
                                          type: "balance",
                                          balance: b,
                                          account: b.account,
                                        })
                                      }
                                    >
                                      Edit
                                    </button>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  )}
                  <p className="footnote">
                    <Info size={14} />
                    Snapshots are independent of transactions. Record all
                    account balances regularly for comparable net-worth totals.
                    A missing account balance is excluded, not assumed to be
                    zero.
                  </p>
                </>
              )}
              {page === "Settings" && (
                <SettingsPage
                  state={state}
                  meta={meta}
                  save={save}
                  busy={busy}
                  api={api}
                  notify={notify}
                  setMeta={setMeta}
                  demo={demo}
                  reviewTransactions={() => {
                    const dates = state.transactions.map((t) => t.date).sort();
                    setCustom({
                      start: dates[0] || today(),
                      end: dates.at(-1) || today(),
                    });
                    setPeriod("custom");
                    setSearch("");
                    setFilter("all");
                    setCatFilter("all");
                    setTxPage(0);
                    setPage("Transactions");
                  }}
                  reviewBalances={() => setPage("Accounts")}
                  openSetup={() => setSetupOpen(true)}
                />
              )}
            </>
          )}
          <footer>
            <span className="footer-brand">clarity.</span>
            <span>A little intention goes a long way.</span>
            <span>
              {state.currency} <span className="footer-dot">·</span> All systems
              local <i />
            </span>
          </footer>
        </div>
      </main>
      {toast && <Toast text={toast} />}
      {(modal === "import" || modal?.type === "import") && (
        <ImportModal
          aiReady={aiReady}
          initialAccount={modal?.account}
          editOnly={modal?.editOnly}
          state={state}
          api={api}
          save={save}
          busy={busy}
          onClose={close}
          onImported={(date) => {
            setMonth(date.slice(0, 7));
            setPeriod("month");
          }}
        />
      )}
      {modal?.type === "category" && (
        <CategoryModal
          category={modal.category}
          initialParent={modal.parentId}
          state={state}
          save={save}
          busy={busy}
          onClose={close}
        />
      )}
      {modal?.type === "merchant-groups" && (
        <MerchantGroupModal
          state={state}
          save={save}
          busy={busy}
          onClose={close}
          transactions={filtered}
        />
      )}
      {modal?.type === "override" && (
        <BudgetOverrideModal
          state={state}
          save={save}
          busy={busy}
          onClose={close}
          initialMonth={start?.slice(0, 7)}
        />
      )}
      {modal?.type === "budget" && (
        <BudgetEditor state={state} save={save} busy={busy} onClose={close} />
      )}
      {modal?.type === "account" && (
        <AccountModal state={state} save={save} busy={busy} onClose={close} />
      )}
      {modal?.type === "balance" && (
        <BalanceModal
          {...modal}
          state={state}
          save={save}
          busy={busy}
          onClose={close}
        />
      )}
      {modal?.type === "delete-transactions" && (
        <Modal
          title={`Delete ${modal.ids.length} transaction${modal.ids.length === 1 ? "" : "s"}?`}
          subtitle="These records will be removed from your totals and budgets."
          onClose={close}
        >
          <div className="form-body">
            <p>
              Your automatic vault backup keeps a copy of the records before
              deletion. Remembered merchant categories are kept.
            </p>
            <p className="form-note">
              Selected records only · {modal.ids.length} transaction
              {modal.ids.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="dialog-actions">
            <Button disabled={busy} onClick={close}>
              Cancel
            </Button>
            <Button
              variant="danger-button"
              disabled={busy || !!demo}
              onClick={async () => {
                if (
                  await save(
                    {
                      ...state,
                      transactions: state.transactions.filter(
                        (t) => !modal.ids.includes(t.id),
                      ),
                    },
                    "Transactions deleted",
                  )
                ) {
                  setSelectedTransactions([]);
                  setTxPage(0);
                  close();
                }
              }}
            >
              Delete {modal.ids.length} transaction
              {modal.ids.length === 1 ? "" : "s"}
            </Button>
          </div>
        </Modal>
      )}
      {modal?.type === "transaction" && (
        <TransactionModal
          {...modal}
          state={state}
          save={save}
          busy={busy}
          onClose={close}
        />
      )}
    </div>
  );
}
function Toast({ text }) {
  const ref = useRef();
  useEffect(() => {
    ref.current?.showPopover?.();
  }, [text]);
  return (
    <div ref={ref} popover="manual" className="toast" role="status">
      <Info size={17} />
      {text}
    </div>
  );
}
function Metric({ label, value, caption, icon: Icon, accent }) {
  return (
    <section className={`metric ${accent ? "accent" : ""}`}>
      <div className="metric-top">
        <span>{label}</span>
        <Icon size={17} />
      </div>
      <h2>{value}</h2>
      <p>{caption}</p>
    </section>
  );
}
function PanelTitle({ title, subtitle, right }) {
  return (
    <div className="panel-title">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}
function CashChart({ state, start, end }) {
  const tx = state.transactions.filter((t) => t.date >= start && t.date <= end);
  const daily = (new Date(end) - new Date(start)) / 864e5 < 63;
  const data = [];
  let d = new Date(start + "T12:00:00");
  if (!daily) d.setDate(1);
  while (dateString(d) <= end) {
    const key = dateString(d).slice(0, daily ? 10 : 7);
    data.push({
      key,
      label: daily
        ? d.toLocaleDateString("en-CA", { month: "short", day: "numeric" })
        : d.toLocaleDateString("en-CA", { month: "short", year: "2-digit" }),
      Income: 0,
      Spending: 0,
    });
    if (daily) d.setDate(d.getDate() + 1);
    else d.setMonth(d.getMonth() + 1);
  }
  tx.forEach((t) => {
    const row = data.find((d) => d.key === t.date.slice(0, daily ? 10 : 7));
    if (row) {
      if (t.kind === "income") row.Income += t.amount / 100;
      if (t.kind === "expense") row.Spending += t.amount / 100;
      if (t.kind === "refund") row.Spending -= t.amount / 100;
    }
  });
  return tx.length ? (
    <div className="chart">
      <ResponsiveContainer width="100%" height={285}>
        <BarChart
          data={data}
          margin={{ top: 25, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            vertical={false}
            stroke="var(--line)"
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            minTickGap={28}
            tick={{ fontSize: 11, fill: "var(--muted)" }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "var(--muted)" }}
            width={50}
            tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)}
          />
          <Tooltip
            {...chartTooltip}
            formatter={(v) => money(Math.round(v * 100), state.currency)}
            cursor={{ fill: "var(--chart-hover)" }}
          />
          <Legend
            iconType="circle"
            iconSize={7}
            wrapperStyle={{ fontSize: 12, paddingTop: 16 }}
          />
          <Bar
            dataKey="Income"
            fill="var(--chart-income)"
            radius={[4, 4, 0, 0]}
            maxBarSize={30}
          />
          <Bar
            dataKey="Spending"
            fill="var(--purple)"
            radius={[4, 4, 0, 0]}
            maxBarSize={30}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  ) : (
    <Empty
      icon={ChartNoAxesCombined}
      title="The bigger picture is taking shape"
    >
      Import a statement to see income and spending over time.
    </Empty>
  );
}
function WorthChart({ state, start, end }) {
  const data = [];
  const d = new Date(start + "T12:00:00");
  d.setDate(1);
  while (dateString(d) <= end) {
    const at = dateString(new Date(d.getFullYear(), d.getMonth() + 1, 0));
    const cutoff = at > end ? end : at;
    const n = netWorth(state, cutoff);
    data.push({
      date: d.toLocaleDateString("en-CA", { month: "short", year: "2-digit" }),
      NetWorth: n.accounts.every((a) => a.balance === null)
        ? null
        : n.total / 100,
      missing: n.missing,
    });
    d.setMonth(d.getMonth() + 1);
  }
  return state.balances.length ? (
    <div className="chart">
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="worth-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--purple)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="var(--purple)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "var(--muted)" }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            width={60}
            tick={{ fontSize: 11, fill: "var(--muted)" }}
            tickFormatter={(v) => `${v / 1000}k`}
          />
          <Tooltip
            {...chartTooltip}
            formatter={(v, name, p) => [
              `${money(v * 100, state.currency)}${p.payload.missing ? ` (${p.payload.missing} missing accounts)` : ""}`,
              "Net worth",
            ]}
          />
          <Area
            type="monotone"
            dataKey="NetWorth"
            stroke="var(--purple)"
            strokeWidth={3}
            fill="url(#worth-gradient)"
            dot={{ r: 4 }}
            connectNulls={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  ) : (
    <Empty icon={TrendingUp} title="Progress starts with a snapshot">
      Record balances each month to see your net worth grow.
    </Empty>
  );
}
function BudgetRow({ category: c, factor, fmt, hideTitle = false }) {
  const target = c.targetBudget ?? Math.round(c.budget * factor),
    spent = c.budgetSpent ?? c.spent,
    over = spent > target && target > 0;
  return (
    <div className="budget-row">
      {!hideTitle && (
        <div className="budget-row-title">
          <span>
            <i style={{ background: c.color }} />
            {c.name}
          </span>
          <small>
            {fmt(spent)} <em>/ {target ? fmt(target) : "No limit"}</em>
          </small>
        </div>
      )}
      {hideTitle && (
        <h2>
          {fmt(spent)} <small>/ {target ? fmt(target) : "No budget yet"}</small>
        </h2>
      )}
      <div className="progress">
        <span
          style={{
            width: target
              ? `${Math.min(100, Math.max(0, (spent / target) * 100))}%`
              : "0%",
            background: over ? "#d39374" : c.color,
          }}
        />
      </div>
      <div className={`budget-status ${over ? "over" : ""}`}>
        {target
          ? over
            ? `${fmt(spent - target)} over budget`
            : `${fmt(target - spent)} remaining`
          : "Set a monthly limit to track progress"}
        {target > 0 && <span>{Math.round((spent / target) * 100)}%</span>}
      </div>
    </div>
  );
}
function Insights({ summary, state, factor, fmt, onReview, onBudget }) {
  const over = summary.categories.filter(
    (c) =>
      (c.targetBudget ?? c.budget) > 0 &&
      (c.budgetSpent ?? c.spent) >
        (c.targetBudget ?? Math.round(c.budget * factor)),
  );
  const largest = summary.categories.find((c) => c.spent > 0);
  return (
    <div className="insights">
      <button className="insight peach" onClick={onBudget}>
        <span className="insight-icon">
          <Target size={19} />
        </span>
        <strong>
          {over.length
            ? `${over[0].name} needs a little attention`
            : "A little planning goes a long way"}
        </strong>
        <p>
          {over.length
            ? `${fmt((over[0].budgetSpent ?? over[0].spent) - (over[0].targetBudget ?? Math.round(over[0].budget * factor)))} above your plan for this range. Start here when looking for room to save.`
            : summary.categories.some((c) => c.targetBudget > 0)
              ? "No budget overruns in this range. Check unbudgeted categories before increasing spending."
              : "Set monthly category limits to spot overspending early."}
        </p>
        <span className="insight-link">
          Review budgets <ArrowUpRight size={14} />
        </span>
      </button>
      <div className="insight lavender">
        <span className="insight-icon">
          <ChartNoAxesCombined size={19} />
        </span>
        <strong>
          {largest
            ? `${largest.name} takes the biggest share`
            : "Small details. Clearer decisions."}
        </strong>
        <p>
          {largest
            ? `${fmt(largest.spent)} in net spending. Review this category first to understand your biggest cost.`
            : "Your most useful insights will appear here once you import your spending."}
        </p>
        <span className="insight-link">Based on this date range</span>
      </div>
      <button className="insight sage" onClick={onReview}>
        <span className="insight-icon">
          <CheckCheck size={19} />
        </span>
        <strong>
          {summary.review
            ? `${summary.review} transactions need a look`
            : "Clarity starts with complete records"}
        </strong>
        <p>
          {summary.review
            ? "Review uncategorized purchases, AI suggestions, and possible transfers for accurate totals."
            : "Import all spending and income accounts. Recorded surplus is only as complete as your statements."}
        </p>
        <span className="insight-link">
          {summary.review ? "Review transactions" : "Check your records"}{" "}
          <ArrowUpRight size={14} />
        </span>
      </button>
    </div>
  );
}
function CategoriesPage({ state, demo, busy, save, open, fmt }) {
  const roots = state.categories.filter((c) => !c.parentId);
  return (
    <>
      <div className="section-heading">
        <h2>
          {roots.length} categories · {state.categories.length - roots.length}{" "}
          subcategories
        </h2>
        <Button
          variant="primary"
          disabled={!!demo}
          onClick={() => open({ type: "category" })}
        >
          <Plus size={16} />
          New category
        </Button>
      </div>
      <div className="category-grid">
        {roots.map((c) => {
          const children = state.categories.filter((x) => x.parentId === c.id);
          return (
            <section className="panel category-card" key={c.id}>
              <div className="panel-title">
                <div>
                  <h2>
                    <i
                      className="category-dot"
                      style={{ background: c.color }}
                    />
                    {c.name}
                  </h2>
                  <p>
                    {c.budgetScope === "combined"
                      ? "One combined budget for this group"
                      : "Separate budgets for direct spending and each subcategory"}
                  </p>
                </div>
                <Button
                  disabled={!!demo}
                  onClick={() => open({ type: "category", category: c })}
                >
                  <SlidersHorizontal size={14} />
                  Edit
                </Button>
              </div>
              <div className="category-budget-line">
                <span>
                  {c.budgetScope === "combined"
                    ? "Combined monthly limit"
                    : "Direct monthly limit"}
                </span>
                <b>{c.budget ? fmt(c.budget) : "Not set"}</b>
              </div>
              {children.map((child) => (
                <div className="subcategory-row" key={child.id}>
                  <span>
                    <i style={{ background: child.color }} />
                    {child.name}
                  </span>
                  <span>
                    {child.budget ? fmt(child.budget) : "No limit"} / month
                  </span>
                  <button
                    className="icon-button"
                    aria-label={`Edit ${c.name} ${child.name}`}
                    disabled={!!demo}
                    onClick={() => open({ type: "category", category: child })}
                  >
                    <SlidersHorizontal size={15} />
                  </button>
                </div>
              ))}
              <button
                className="text-button"
                disabled={!!demo || c.id === "uncategorized"}
                onClick={() => open({ type: "category", parentId: c.id })}
              >
                <Plus size={14} />
                Add subcategory
              </button>
              {c.budgetScope === "combined" &&
                children.some((x) => x.budget > 0) && (
                  <p className="form-note">
                    Child targets sit inside this combined limit. They do not
                    increase your total budget.
                  </p>
                )}
            </section>
          );
        })}
      </div>
      <section className="panel merchant-rules">
        <PanelTitle
          title="What Clarity remembers"
          subtitle="Your category choices teach future imports. These rules take priority over AI."
        />
        {state.merchantRules?.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Merchant</th>
                  <th>Remembered category</th>
                </tr>
              </thead>
              <tbody>
                {state.merchantRules.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.merchant}
                      <small>Matches the cleaned statement name</small>
                    </td>
                    <td>
                      <select
                        aria-label={`Remembered category for ${r.merchant}`}
                        disabled={busy || !!demo}
                        value={r.category}
                        onChange={(e) =>
                          save(
                            {
                              ...state,
                              merchantRules: state.merchantRules.map((x) =>
                                x.id === r.id
                                  ? { ...x, category: e.target.value }
                                  : x,
                              ),
                            },
                            "Merchant category updated",
                          )
                        }
                      >
                        {state.categories
                          .filter((c) => c.id !== "uncategorized")
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {categoryLabel(state.categories, c.id)}
                            </option>
                          ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="body-copy">
            Choose a category on a transaction or in an import preview. Clarity
            remembers the cleaned merchant name and fills it in next time,
            without an AI call.
          </p>
        )}
      </section>
    </>
  );
}
const chartTooltip = {
  contentStyle: {
    background: "var(--card)",
    color: "var(--ink)",
    border: "1px solid var(--line)",
    borderRadius: 12,
    fontSize: 12,
  },
  labelStyle: { color: "var(--ink)" },
  itemStyle: { color: "var(--ink)" },
  cursor: { stroke: "var(--purple)", fill: "var(--chart-hover)" },
};

function BudgetOverrideModal({ state, save, busy, onClose, initialMonth }) {
  const [month, setMonth] = useState(initialMonth || today().slice(0, 7)),
    [category, setCategory] = useState(
      state.categories.find((c) => c.id !== "uncategorized")?.id ||
        "uncategorized",
    );
  const current = (state.budgetOverrides || []).find(
    (o) => o.month === month && o.category === category,
  );
  const base = state.categories.find((c) => c.id === category);
  const [amount, setAmount] = useState(""),
    [note, setNote] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    setAmount(String((current?.budget ?? base?.budget ?? 0) / 100));
    setNote(current?.note || "");
    setError("");
  }, [month, category, current?.budget, current?.note, base?.budget]);
  return (
    <Modal
      title="A different budget, just this month"
      subtitle="Your usual monthly budget stays unchanged. Other months return to your regular plan."
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const budget = cents(amount);
            if (budget === null || budget < 0)
              throw Error(
                "Enter a non-negative limit. Zero means no limit for this month.",
              );
            const id = category + ":" + month;
            const next = { id, category, month, budget, note };
            if (
              await save(
                {
                  ...state,
                  budgetOverrides: [
                    ...(state.budgetOverrides || []).filter((o) => o.id !== id),
                    next,
                  ],
                },
                "Temporary monthly budget saved",
              )
            )
              onClose();
          } catch (e) {
            setError(e.message);
          }
        }}
      >
        <div className="form-body">
          <div className="form-grid">
            <Field label="Month">
              <input
                type="month"
                required
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </Field>
            <Field label="Category or subcategory">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {state.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {categoryLabel(state.categories, c.id)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <p className="notice">
            Usual monthly limit: {money(base?.budget || 0, state.currency)}.{" "}
            {base?.budgetScope === "combined"
              ? "This overrides the combined group limit."
              : "This overrides the direct category limit."}
          </p>
          <Field label={`Limit for this month (${state.currency})`}>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Field label="Reason (optional)">
            <input
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Travel, guests, or a one-off purchase"
            />
          </Field>
          {current && (
            <Button
              type="button"
              disabled={busy}
              onClick={async () => {
                if (
                  await save(
                    {
                      ...state,
                      budgetOverrides: state.budgetOverrides.filter(
                        (o) => o.id !== current.id,
                      ),
                    },
                    "Usual budget restored for this month",
                  )
                )
                  onClose();
              }}
            >
              Restore usual limit for {month}
            </Button>
          )}
          {(state.budgetOverrides || []).length > 0 && (
            <div className="override-list">
              <h3>Saved monthly adjustments</h3>
              {[...state.budgetOverrides]
                .sort((a, b) => b.month.localeCompare(a.month))
                .map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => {
                      setMonth(o.month);
                      setCategory(o.category);
                    }}
                  >
                    <span>
                      {o.month} · {categoryLabel(state.categories, o.category)}
                      <small>{o.note || "One-month adjustment"}</small>
                    </span>
                    <b>{money(o.budget, state.currency)}</b>
                  </button>
                ))}
            </div>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="dialog-actions">
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={busy}>
            Save monthly override
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function BudgetEditor({ state, save, busy, onClose }) {
  const categories = state.categories;
  const [mode, setMode] = useState("multiple");
  const [selected, setSelected] = useState(
    categories.filter((c) => c.id !== "uncategorized").map((c) => c.id),
  );
  const [single, setSingle] = useState(
    categories.find((c) => c.id !== "uncategorized")?.id || "uncategorized",
  );
  const [amounts, setAmounts] = useState(
    Object.fromEntries(
      categories.map((c) => [c.id, c.budget ? String(c.budget / 100) : ""]),
    ),
  );
  const [scopes, setScopes] = useState(
    Object.fromEntries(
      categories.map((c) => [c.id, c.budgetScope || "separate"]),
    ),
  );
  const [error, setError] = useState("");
  const active = mode === "single" ? [single] : selected;
  let total = null;
  try {
    total = plannedBudget(updateBudgets(categories, active, amounts, scopes));
  } catch {}
  return (
    <Modal
      title="Create your spending plan"
      subtitle="Set monthly limits for one category or plan them all together."
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            const next = updateBudgets(categories, active, amounts, scopes);
            if (
              await save(
                { ...state, categories: next },
                "Monthly budgets saved",
              )
            )
              onClose();
          } catch (e) {
            setError(e.message);
          }
        }}
      >
        <div className="form-body">
          <div
            className="budget-mode"
            role="group"
            aria-label="Budget creation mode"
          >
            <button
              type="button"
              aria-pressed={mode === "single"}
              onClick={() => setMode("single")}
            >
              One category
            </button>
            <button
              type="button"
              aria-pressed={mode === "multiple"}
              onClick={() => setMode("multiple")}
            >
              Multiple categories
            </button>
          </div>
          {mode === "single" ? (
            <Field label="Choose category">
              <select
                value={single}
                onChange={(e) => setSingle(e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {categoryLabel(categories, c.id)}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <div className="budget-selection">
              <span>{selected.length} categories selected</span>
              <Button
                type="button"
                onClick={() => setSelected(categories.map((c) => c.id))}
              >
                Select all
              </Button>
              <Button type="button" onClick={() => setSelected([])}>
                Clear selection
              </Button>
            </div>
          )}
          <p className="form-note">
            A combined group limit includes its subcategories. Child targets
            inside it are not counted twice. Blank or zero removes a limit;
            unselected categories stay unchanged.
          </p>
          <div className="budget-builder-list">
            {categories
              .filter((c) => mode === "multiple" || c.id === single)
              .map((c) => (
                <div
                  className={`budget-builder-row ${c.parentId ? "child" : ""}`}
                  key={c.id}
                >
                  {mode === "multiple" && (
                    <input
                      type="checkbox"
                      aria-label={`Include ${categoryLabel(categories, c.id)}`}
                      checked={selected.includes(c.id)}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [...selected, c.id]
                            : selected.filter((id) => id !== c.id),
                        )
                      }
                    />
                  )}
                  <div className="budget-builder-name">
                    <strong>{categoryLabel(categories, c.id)}</strong>
                    {!c.parentId &&
                    categories.some((x) => x.parentId === c.id) ? (
                      <select
                        aria-label={`Budget scope for ${c.name}`}
                        disabled={!active.includes(c.id)}
                        value={scopes[c.id]}
                        onChange={(e) =>
                          setScopes({ ...scopes, [c.id]: e.target.value })
                        }
                      >
                        <option value="combined">
                          Combined with subcategories
                        </option>
                        <option value="separate">This category only</option>
                      </select>
                    ) : (
                      <small>
                        {c.parentId ? "Subcategory target" : "Monthly limit"}
                      </small>
                    )}
                  </div>
                  <label className="budget-amount">
                    <span>{state.currency} / month</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="No limit"
                      aria-label={`Monthly budget for ${categoryLabel(categories, c.id)}`}
                      disabled={!active.includes(c.id)}
                      value={amounts[c.id]}
                      onChange={(e) =>
                        setAmounts({ ...amounts, [c.id]: e.target.value })
                      }
                    />
                  </label>
                </div>
              ))}
          </div>
          <div className="budget-plan-total">
            <span>Total monthly plan</span>
            <strong>
              {total === null ? "—" : money(total, state.currency)}
            </strong>
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="dialog-actions">
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={busy || !active.length}>
            Save {active.length === 1 ? "budget" : "budgets"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function CategoryModal({
  category,
  state,
  save,
  busy,
  onClose,
  initialParent = "",
  extraTop,
}) {
  const [name, setName] = useState(category?.name || ""),
    [budget, setBudget] = useState(
      category ? String(category.budget / 100) : "",
    ),
    [color, setColor] = useState(category?.color || "#a48bcf"),
    [parentId, setParentId] = useState(category?.parentId || initialParent),
    [scope, setScope] = useState(category?.budgetScope || "separate"),
    [error, setError] = useState("");
  const hasChildren = state.categories.some((c) => c.parentId === category?.id),
    parent = state.categories.find((c) => c.id === parentId);
  async function submit(e) {
    e.preventDefault();
    try {
      const amount = cents(budget) || 0;
      if (amount < 0) throw Error("Budget cannot be negative");
      if (
        state.categories.some(
          (c) =>
            c.id !== category?.id &&
            (c.parentId || "") === parentId &&
            c.name.toLowerCase() === name.trim().toLowerCase(),
        )
      )
        throw Error("This name already exists in this category group");
      const c = {
        id: category?.id || uid(),
        name: name.trim(),
        budget: amount,
        color,
        parentId,
        budgetScope: parentId ? "separate" : scope,
      };
      if (
        await save({
          ...state,
          categories: category
            ? state.categories.map((x) => (x.id === c.id ? c : x))
            : [...state.categories, c],
        })
      )
        onClose();
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <Modal
      title={
        category
          ? "Edit category & budget"
          : parentId
            ? "Create a subcategory"
            : "Create a category"
      }
      subtitle="Organize your spending. Set a combined limit or individual budgets."
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="form-body">
          {extraTop}
          <Field label="Category name">
            <input
              required
              maxLength={99}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Food or Coffee"
            />
          </Field>
          <Field
            label="Parent category"
            hint={
              hasChildren
                ? "A category with children must remain a top-level group."
                : "Choose a parent to make this a subcategory."
            }
          >
            <select
              disabled={hasChildren || category?.id === "uncategorized"}
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
            >
              <option value="">None · top-level category</option>
              {state.categories
                .filter(
                  (c) =>
                    !c.parentId &&
                    c.id !== category?.id &&
                    c.id !== "uncategorized",
                )
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {categoryLabel(state.categories, c.id)}
                  </option>
                ))}
            </select>
          </Field>
          {!parentId && (
            <Field label="Budget arrangement">
              <select value={scope} onChange={(e) => setScope(e.target.value)}>
                <option value="separate">
                  Separate · this category and each child have their own limits
                </option>
                <option value="combined">
                  Combined · one limit for this category and all children
                </option>
              </select>
            </Field>
          )}
          <div className="form-grid">
            <Field
              label={`${!parentId && scope === "combined" ? "Combined monthly limit" : "Monthly limit"} (${state.currency})`}
              hint={
                parent?.budgetScope === "combined"
                  ? "Optional child target within the parent limit; not added to the total."
                  : !parentId && scope === "separate"
                    ? "Covers direct spending here. Subcategory limits are added separately."
                    : "Leave blank for no limit."
              }
            >
              <input
                type="number"
                min="0"
                step="0.01"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="0.00"
              />
            </Field>
            <Field label="Category colour">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </Field>
          </div>
          {error && <p className="error">{error}</p>}
        </div>
        <div className="dialog-actions">
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={busy}>
            Save category & budget
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function AccountModal({ state, save, busy, onClose }) {
  const [name, setName] = useState(""),
    [type, setType] = useState("bank");
  return (
    <Modal
      title="Add an account"
      subtitle="Just a name and type. No bank connection needed."
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await save({
              ...state,
              accounts: [
                ...state.accounts,
                { id: uid(), name: name.trim(), type },
              ],
            })
          )
            onClose();
        }}
      >
        <div className="form-body">
          <Field label="Account name">
            <input
              required
              maxLength={99}
              placeholder="e.g. Everyday chequing"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Account type">
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {[
                ["bank", "Chequing / debit"],
                ["savings", "Savings"],
                ["credit", "Credit card"],
                ["investment", "Investment"],
                ["loan", "Loan"],
                ["cash", "Cash"],
              ].map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="dialog-actions">
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={busy}>
            Add account
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function BalanceModal({ state, account, balance, save, busy, onClose }) {
  const [acc, setAcc] = useState(account || state.accounts[0]?.id || ""),
    [date, setDate] = useState(balance?.date || today()),
    [amount, setAmount] = useState(balance ? String(balance.amount / 100) : ""),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState(false);
  const a = state.accounts.find((a) => a.id === acc);
  const existing = state.balances.find(
    (b) => b.account === acc && b.date === date && b.id !== balance?.id,
  );
  return (
    <Modal
      title={
        balance ? "Edit balance snapshot" : "A snapshot of where you stand"
      }
      subtitle="Your balance journal is separate from imported transactions."
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const n = cents(amount);
            if (n === null) throw Error("Enter a balance");
            if (existing && !confirm)
              throw Error("Confirm replacement of the existing snapshot.");
            const b = {
              id: balance?.id || existing?.id || uid(),
              account: acc,
              date,
              amount: n,
            };
            if (
              await save({
                ...state,
                balances: [
                  ...state.balances.filter(
                    (x) => x.id !== b.id && x.id !== existing?.id,
                  ),
                  b,
                ],
              })
            )
              onClose();
          } catch (e) {
            setError(e.message);
          }
        }}
      >
        <div className="form-body">
          <Field label="Account">
            <select
              required
              value={acc}
              onChange={(e) => {
                setAcc(e.target.value);
                setConfirm(false);
              }}
            >
              {state.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="form-grid">
            <Field label="Snapshot date">
              <input
                required
                type="date"
                max={today()}
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setConfirm(false);
                }}
              />
            </Field>
            <Field
              label={`Balance (${state.currency})`}
              hint={
                ["credit", "loan"].includes(a?.type)
                  ? "Enter money owed as a positive amount."
                  : "Enter the actual balance on this date."
              }
            >
              <input
                required
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </Field>
          </div>
          {existing && (
            <label className="check-row">
              <input
                type="checkbox"
                checked={confirm}
                onChange={(e) => setConfirm(e.target.checked)}
              />
              Replace the existing balance for this account and date.
            </label>
          )}
          {error && <p className="error">{error}</p>}
        </div>
        <div className="dialog-actions">
          {balance && (
            <Button
              type="button"
              variant="danger-button"
              disabled={busy}
              onClick={async () => {
                if (
                  await save({
                    ...state,
                    balances: state.balances.filter((b) => b.id !== balance.id),
                  })
                )
                  onClose();
              }}
            >
              <Trash2 size={15} />
              Delete
            </Button>
          )}
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={busy}>
            Save snapshot
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function MerchantGroupFields({
  transactions,
  state,
  onChange,
  disabled = false,
}) {
  const groups = merchantGroups(transactions);
  return (
    <div className="merchant-group-fields">
      <p className="form-note">
        Choose once per merchant. This applies to every included purchase and
        refund in that group, including previously assigned categories.
        Individual records remain separate.
      </p>
      {groups.length ? (
        groups.map((g) => (
          <div className="merchant-group-row" key={g.key}>
            <div>
              <strong>{g.name}</strong>
              <small>
                {g.transactions.length} transaction
                {g.transactions.length === 1 ? "" : "s"}
              </small>
              <details>
                <summary>View descriptions</summary>
                {[
                  ...new Set(
                    g.transactions.map((t) => t.description || t.merchant),
                  ),
                ].map((d) => (
                  <p key={d}>{d}</p>
                ))}
              </details>
            </div>
            <select
              aria-label={`Category for merchant ${g.name}`}
              disabled={disabled}
              value={g.category || "uncategorized"}
              onChange={(e) => onChange(g.key, e.target.value)}
            >
              {g.category === "mixed" && (
                <option value="mixed" disabled>
                  Mixed categories
                </option>
              )}
              {state.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {categoryLabel(state.categories, c.id)}
                </option>
              ))}
            </select>
          </div>
        ))
      ) : (
        <p className="body-copy">
          No included purchases or refunds to categorize.
        </p>
      )}
    </div>
  );
}
function MerchantGroupModal({ state, save, busy, onClose, transactions }) {
  const [choices, setChoices] = useState({});
  const preview = Object.entries(choices).reduce(
    (rows, [key, cat]) => applyGroupCategory(rows, key, cat),
    transactions,
  );
  return (
    <Modal
      title="Categorize by merchant"
      subtitle="Matching merchants in the current transaction view, grouped for faster review."
      onClose={onClose}
    >
      <div className="form-body">
        <MerchantGroupFields
          state={state}
          transactions={preview}
          disabled={busy}
          onChange={(key, cat) => setChoices({ ...choices, [key]: cat })}
        />
      </div>
      <div className="dialog-actions">
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          disabled={busy || !Object.keys(choices).length}
          onClick={async () => {
            const ids = new Set(transactions.map((t) => t.id));
            let next = state;
            const changed = Object.entries(choices).reduce(
              (rows, [key, cat]) => applyGroupCategory(rows, key, cat),
              transactions,
            );
            for (const t of changed)
              if (choices[merchantGroupKey(t)])
                next = rememberCategory(next, t);
            if (
              await save(
                {
                  ...next,
                  transactions: state.transactions.map((t) =>
                    ids.has(t.id) ? changed.find((x) => x.id === t.id) : t,
                  ),
                },
                "Merchant categories saved",
              )
            )
              onClose();
          }}
        >
          Save categories
        </Button>
      </div>
    </Modal>
  );
}
function TransactionModal({
  transaction: t,
  state,
  save,
  busy,
  onClose,
  initialKind = "expense",
}) {
  const [form, setForm] = useState(
      t
        ? {
            ...localCategorize([transactionDetails(t)], state)[0],
            amount: String(t.amount / 100),
          }
        : {
            date: today(),
            description: "",
            merchant: "",
            location: "",
            reference: "",
            amount: "",
            kind: initialKind,
            category: "",
            account:
              initialKind === "expense" ? state.accounts[0]?.id || "" : "",
          },
    ),
    [error, setError] = useState(""),
    [deleteConfirm, setDeleteConfirm] = useState(false),
    [manualCategory, setManualCategory] = useState(
      !!t && t.category !== "uncategorized",
    ),
    [applyExisting, setApplyExisting] = useState(true);
  const errorRef = useRef(null);
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ block: "nearest" });
  }, [error]);
  const nameLabel = {
    expense: "Merchant name",
    income: "Income source",
    refund: "Merchant name",
    transfer: "Transfer name",
  }[form.kind];
  const names = approvedNames(state, form.kind);
  const needsCategory = ["expense", "refund"].includes(form.kind);
  function field(k, v) {
    setError("");
    if (k === "category") setManualCategory(true);
    const next = { ...form, [k]: v };
    if (k === "kind" || k === "merchant") {
      const match = approvedNames(state, next.kind).find(
        (n) => n.key === merchantKey(next.merchant),
      );
      const learned = localCategorize(
        [
          {
            ...next,
            description: k === "merchant" ? v : next.description,
            category: "uncategorized",
          },
        ],
        state,
      )[0];
      if (k === "kind" || k === "merchant" || !manualCategory)
        next.category =
          match?.category ||
          (learned.category !== "uncategorized"
            ? learned.category
            : next.kind === "expense"
              ? "uncategorized"
              : "");
      if (k === "kind" || k === "merchant") setManualCategory(false);
    }
    if (!["expense", "refund"].includes(next.kind)) next.category = "";
    setForm(next);
  }
  return (
    <Modal
      title={t ? "Edit transaction" : "Add a transaction"}
      subtitle="Start with the essentials. Add a description or other details only when useful."
      onClose={onClose}
    >
      <form
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            if (
              needsCategory &&
              (!form.category ||
                form.category === "uncategorized" ||
                !state.categories.some((c) => c.id === form.category))
            )
              throw Error("Choose a category for this " + form.kind + ".");
            if (form.kind === "expense" && !form.account)
              throw Error("Choose an account for this expense.");
            if (!form.merchant.trim())
              throw Error(`Enter ${nameLabel.toLowerCase()}.`);
            if (!validDate(form.date))
              throw Error("Enter a valid transaction date.");
            const amount = cents(form.amount);
            if (!amount || amount < 0)
              throw Error(
                "Use a positive amount and choose the transaction type.",
              );
            const next = {
              ...transactionDetails(form),
              amount,
              category: needsCategory ? form.category : "",
              id: t?.id || uid(),
              source: "reviewed",
              review: false,
            };
            let learnedState = rememberCategory(state, next);
            let transactions = t
              ? state.transactions.map((x) => (x.id === t.id ? next : x))
              : [...state.transactions, next];
            if (applyExisting)
              transactions = transactions.map((x) =>
                merchantGroupKey(x) === merchantGroupKey(next)
                  ? localCategorize([x], learnedState)[0]
                  : x,
              );
            if (
              await save(
                { ...learnedState, transactions },
                t
                  ? "Transaction updated successfully."
                  : "Transaction added successfully.",
                setError,
              )
            )
              onClose();
          } catch (e) {
            setError(e.message);
          }
        }}
      >
        <div className="form-body">
          {error && (
            <p ref={errorRef} className="notice danger" role="alert">
              {error}
            </p>
          )}
          <h3 className="form-section-title">Transaction essentials</h3>
          <Field label="Transaction type">
            <select
              value={form.kind}
              onChange={(e) => field("kind", e.target.value)}
            >
              {kinds.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </Field>
          <Field
            label={nameLabel}
            hint="Type a name or choose one you have already categorized."
          >
            <input
              required
              maxLength={999}
              list="approved-transaction-names"
              autoComplete="off"
              value={form.merchant}
              onChange={(e) => field("merchant", e.target.value)}
            />
            <datalist id="approved-transaction-names">
              {names.map((n) => (
                <option key={n.key} value={n.name} />
              ))}
            </datalist>
          </Field>
          <div className="form-grid">
            <Field label="Date">
              <input
                required
                type="date"
                value={form.date}
                onChange={(e) => field("date", e.target.value)}
              />
            </Field>
            <Field label={`Amount (${state.currency})`}>
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(e) => field("amount", e.target.value)}
              />
            </Field>
          </div>
          {form.kind === "expense" && (
            <Field label="Account">
              <select
                required
                value={form.account}
                onChange={(e) => field("account", e.target.value)}
              >
                <option value="" disabled>
                  Choose an account
                </option>
                {state.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {needsCategory && (
            <Field
              label="Category"
              hint={
                form.kind === "refund"
                  ? "Choose the original purchase category so this refund reduces the right budget."
                  : "Required for expenses."
              }
            >
              <select
                required
                value={form.category === "uncategorized" ? "" : form.category}
                onChange={(e) => field("category", e.target.value)}
              >
                <option value="" disabled>
                  Choose a category
                </option>
                {state.categories
                  .filter((c) => c.id !== "uncategorized")
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {categoryLabel(state.categories, c.id)}
                    </option>
                  ))}
              </select>
            </Field>
          )}
          <h3 className="form-section-title optional-section">
            Optional details
          </h3>
          {form.kind !== "expense" && (
            <Field label="Account (optional)">
              <select
                value={form.account}
                onChange={(e) => field("account", e.target.value)}
              >
                <option value="">No account</option>
                {state.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {needsCategory &&
            form.category &&
            form.category !== "uncategorized" && (
              <p className="form-note">
                Category: {categoryLabel(state.categories, form.category)}. Your
                approved names are available next time.
              </p>
            )}
          <Field
            label="Description (optional)"
            hint="You can edit this text. Changing imported details may affect duplicate detection on future imports."
          >
            <input
              maxLength={999}
              value={form.description}
              onChange={(e) => field("description", e.target.value)}
            />
          </Field>
          <div className="form-grid">
            <Field label="Location (optional)">
              <input
                maxLength={999}
                value={form.location}
                onChange={(e) => field("location", e.target.value)}
              />
            </Field>
            <Field label="Reference / store number (optional)">
              <input
                maxLength={999}
                value={form.reference}
                onChange={(e) => field("reference", e.target.value)}
              />
            </Field>
          </div>
          {["expense", "refund"].includes(form.kind) &&
            form.category &&
            form.category !== "uncategorized" && (
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={applyExisting}
                  onChange={(e) => setApplyExisting(e.target.checked)}
                />
                Also fill matching uncategorized purchases already in the vault.
              </label>
            )}
        </div>
        <div className="dialog-actions">
          {t && (
            <Button
              type="button"
              variant="danger-button"
              disabled={busy}
              onClick={async () => {
                if (!deleteConfirm) {
                  setDeleteConfirm(true);
                  return;
                }
                if (
                  await save(
                    {
                      ...state,
                      transactions: state.transactions.filter(
                        (x) => x.id !== t.id,
                      ),
                    },
                    "Transaction deleted successfully.",
                    setError,
                  )
                )
                  onClose();
              }}
            >
              <Trash2 size={15} />
              {deleteConfirm ? "Confirm delete" : "Delete"}
            </Button>
          )}
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={busy}>
            {["expense", "refund"].includes(form.kind) &&
            form.category &&
            form.category !== "uncategorized"
              ? "Save & remember"
              : "Save transaction"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function SettingsPage({
  state,
  meta,
  save,
  busy,
  api,
  notify,
  setMeta,
  demo,
  reviewTransactions,
  reviewBalances,
  openSetup,
}) {
  const [displayName, setDisplayName] = useState(state.displayName || "");
  const [currency, setCurrency] = useState(state.currency),
    [model, setModel] = useState(state.model),
    [key, setKey] = useState(""),
    [working, setWorking] = useState(false),
    [themeOpen, setThemeOpen] = useState(false),
    [vaultOpen, setVaultOpen] = useState(false),
    [vaultPath, setVaultPath] = useState(meta.vaultPath || ""),
    [vaultError, setVaultError] = useState("");
  const locked = !!(state.transactions.length || state.balances.length);
  const disabled = busy || working || !!demo;
  const selectedTheme = themes.find((t) => t.id === state.theme) || themes[0];
  return (
    <div className="settings-layout">
      <div className="settings-intro">
        <span className="eyebrow">MAKE IT YOURS</span>
        <p>Your preferences, connections, and local files in one place.</p>
      </div>
      <section className="panel settings-section">
        <div className="settings-heading">
          <div>
            <h2>Your profile</h2>
            <p>A personal touch for your money journal.</p>
          </div>
          <Button disabled={disabled} onClick={openSetup}>
            <Sparkles size={16} />
            Open setup guide
          </Button>
        </div>
        <form
          className="settings-row"
          onSubmit={async (e) => {
            e.preventDefault();
            await save(
              { ...state, displayName: displayName.trim() },
              "Display name saved",
            );
          }}
        >
          <div>
            <h3>Display name</h3>
            <p>Used in your workspace. No account or sign-in needed.</p>
          </div>
          <div className="settings-controls">
            <Field label="Your name">
              <input
                maxLength={80}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="What should we call you?"
              />
            </Field>
            <Button
              disabled={
                disabled || displayName.trim() === (state.displayName || "")
              }
            >
              Save name
            </Button>
          </div>
        </form>
      </section>
      <section className="panel settings-section">
        <div className="settings-heading">
          <Palette size={22} />
          <div>
            <h2>Appearance & currency</h2>
            <p>Make your workspace feel familiar.</p>
          </div>
        </div>
        <div className="settings-row">
          <div>
            <h3>Theme</h3>
            <p>
              {selectedTheme.name} · {selectedTheme.description}
            </p>
          </div>
          <Button disabled={disabled} onClick={() => setThemeOpen(true)}>
            Change theme
          </Button>
        </div>
        <form
          className="settings-row settings-currency"
          onSubmit={async (e) => {
            e.preventDefault();
            await save({ ...state, currency });
          }}
        >
          <div>
            <h3>Currency</h3>
            <p>
              {locked
                ? `${state.transactions.length} transactions and ${state.balances.length} balance snapshots remain across all dates. Currency stays locked until these records are removed; changing a label would not convert their amounts.`
                : "One currency for all accounts. Amounts are not converted."}
            </p>
            <span className="status-label">
              {state.currency} · {currencyName(state.currency)}
            </span>
            {locked && (
              <div className="settings-buttons">
                {state.transactions.length > 0 && (
                  <Button type="button" onClick={reviewTransactions}>
                    Review all {state.transactions.length} transactions
                  </Button>
                )}
                {state.balances.length > 0 && (
                  <Button type="button" onClick={reviewBalances}>
                    Review balance snapshots
                  </Button>
                )}
              </div>
            )}
          </div>
          <div className="settings-controls">
            <Field label="Dashboard currency">
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                disabled={locked || disabled}
              >
                <optgroup label="Favourites">
                  {favouriteCurrencies.map((c) => (
                    <option key={c} value={c}>
                      {c} — {currencyName(c)}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="All currencies">
                  {currencyCodes
                    .filter((c) => !favouriteCurrencies.includes(c))
                    .map((c) => (
                      <option key={c} value={c}>
                        {c} — {currencyName(c)}
                      </option>
                    ))}
                </optgroup>
              </select>
            </Field>
            <Button
              variant="primary"
              disabled={locked || disabled || currency === state.currency}
            >
              Save currency
            </Button>
          </div>
        </form>
      </section>
      <section className="panel settings-section">
        <div className="settings-heading">
          <Sparkles size={22} />
          <div>
            <h2>AI categorization</h2>
            <p>Optional help that learns from your approved categories.</p>
          </div>
          <span
            className={`status-label ${meta.keyConfigured ? "connected" : ""}`}
          >
            {meta.keyConfigured ? "Connected" : "Not connected"}
          </span>
        </div>
        <div className="settings-row">
          <div>
            <h3>OpenAI connection</h3>
            <p>
              Descriptions and category examples are sent to OpenAI. Balances
              and transaction amounts stay local. API usage is billed to your
              OpenAI account.
            </p>
            <p>
              {meta.platform === "desktop"
                ? "Your key is protected by your operating system and stays connected after restarting."
                : "Your key is saved in this app’s .env file, outside your Markdown vault. It stays connected after restarting."}
            </p>
          </div>
          <form
            className="settings-controls"
            onSubmit={async (e) => {
              e.preventDefault();
              setWorking(true);
              try {
                const r = await api("key", { key });
                setMeta((m) => ({ ...m, ...r }));
                setKey("");
                notify("API key verified and saved locally.");
              } catch (e) {
                notify(e.message);
              } finally {
                setWorking(false);
              }
            }}
          >
            <Field
              label={meta.keyConfigured ? "Replace API key" : "OpenAI API key"}
            >
              <input
                type="password"
                autoComplete="off"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="sk-…"
                required
              />
            </Field>
            <div className="settings-buttons">
              <Button variant="primary" disabled={disabled || !key.trim()}>
                {working ? "Saving…" : "Save key"}
              </Button>
              {meta.keyConfigured && (
                <Button
                  type="button"
                  disabled={disabled}
                  onClick={async () => {
                    setWorking(true);
                    try {
                      const r = await api("key", { key: "" });
                      setMeta((m) => ({ ...m, ...r }));
                      setKey("");
                      notify("API key removed from local configuration.");
                    } catch (e) {
                      notify(e.message);
                    } finally {
                      setWorking(false);
                    }
                  }}
                >
                  Disconnect
                </Button>
              )}
            </div>
          </form>
        </div>
        {meta.modelError && <p className="notice danger">{meta.modelError}</p>}
        {meta.keyConfigured && !!meta.models?.length && (
          <form
            className="settings-row"
            onSubmit={async (e) => {
              e.preventDefault();
              await save({ ...state, model });
            }}
          >
            <div>
              <h3>Categorization model</h3>
              <p>Models available to your connected key.</p>
            </div>
            <div className="settings-controls">
              <Field label="OpenAI model">
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                >
                  {!meta.models.some((m) => m.id === model) && (
                    <option value={model} disabled>
                      Select an available model
                    </option>
                  )}
                  {meta.models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Button
                disabled={
                  disabled ||
                  model === state.model ||
                  !meta.models.some((m) => m.id === model)
                }
              >
                Save model
              </Button>
            </div>
          </form>
        )}
      </section>
      <section className="panel settings-section">
        <div className="settings-heading">
          <FolderOpen size={22} />
          <div>
            <h2>Storage & backups</h2>
            <p>
              {meta.platform === "server"
                ? "Your files stay on your server, ready for Obsidian."
                : "Your files stay on your computer, ready for Obsidian."}
            </p>
          </div>
        </div>
        <div className="settings-row">
          <div>
            <h3>Vault location</h3>
            <code className="path">{meta.vaultPath}</code>
            <p>
              Moving the vault carries your records, notes, preferences, and
              backups to a new folder.
            </p>
          </div>
          <Button
            disabled={disabled}
            onClick={() => {
              setVaultPath(meta.vaultPath);
              setVaultError("");
              setVaultOpen(true);
            }}
          >
            Move vault
          </Button>
        </div>
        <div className="settings-row">
          <div>
            <h3>Automatic backups</h3>
            <p>
              The latest 30 snapshots are kept in the vault’s .backups folder.
              Every save is recoverable after interruptions.
            </p>
          </div>
          <span className="status-label connected">Always on</span>
        </div>
        <details className="settings-help">
          <summary>Editing files in Obsidian</summary>
          <p>
            Keep table headers and record IDs intact. After editing, use the
            dashboard reload button to read your latest changes. Close editors
            while moving the vault.
          </p>
        </details>
      </section>
      {themeOpen && (
        <Modal
          title="Choose your theme"
          subtitle="Select a palette to apply and save it."
          onClose={() => setThemeOpen(false)}
        >
          <div className="dialog-body">
            <div className="theme-options">
              {themes.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`theme-option ${state.theme === t.id ? "selected" : ""}`}
                  aria-pressed={state.theme === t.id}
                  disabled={disabled}
                  onClick={async () => {
                    if (
                      await save(
                        { ...state, theme: t.id },
                        `${t.name} theme saved`,
                      )
                    )
                      setThemeOpen(false);
                  }}
                >
                  <span className="theme-swatches">
                    {t.colors.map((color) => (
                      <i key={color} style={{ background: color }} />
                    ))}
                  </span>
                  <strong>{t.name}</strong>
                  <small>{t.description}</small>
                  {state.theme === t.id && <Check size={16} />}
                </button>
              ))}
            </div>
          </div>
        </Modal>
      )}
      {vaultOpen && (
        <Modal
          title="Move your vault"
          subtitle="All existing files move together. No records are reset."
          onClose={() => {
            if (!working) setVaultOpen(false);
          }}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setWorking(true);
              setVaultError("");
              try {
                const r = await api("vault", {
                  path: vaultPath.trim(),
                  revision: meta.revision,
                });
                setMeta((m) => ({ ...m, ...r }));
                setVaultOpen(false);
                notify(
                  r.cleanupWarning ||
                    "Vault moved. Future saves use the new folder.",
                );
              } catch (e) {
                setVaultError(e.message);
              } finally {
                setWorking(false);
              }
            }}
          >
            <div className="dialog-body">
              <Button
                type="button"
                disabled={working || meta.folderPickerAvailable === false}
                onClick={async () => {
                  setWorking(true);
                  setVaultError("");
                  try {
                    const result = await api("vault/pick", {});
                    if (result.path) setVaultPath(result.path);
                  } catch (e) {
                    setVaultError(e.message);
                  } finally {
                    setWorking(false);
                  }
                }}
              >
                <FolderOpen size={18} />
                {working ? "Choosing folder…" : "Choose folder…"}
              </Button>
              <p className="form-note">
                {meta.platform === "server"
                  ? "Enter a new or empty folder path on the server. Your browser cannot select a folder on another computer."
                  : "Opens your computer’s folder picker. Select an empty folder, or create a new one there."}
              </p>
              <Field
                label="Selected folder"
                hint="Use a full path to a new or empty folder. Missing folders are created automatically."
              >
                <input
                  required
                  value={vaultPath}
                  onChange={(e) => setVaultPath(e.target.value)}
                  placeholder="/Users/your-name/Documents/My money"
                  disabled={working}
                />
              </Field>
              <p className="notice">
                Close Obsidian and other editors before moving. Your files are
                copied and verified before the old copy is removed.
              </p>
              {vaultError && (
                <p className="notice danger" role="alert">
                  {vaultError}
                </p>
              )}
            </div>
            <div className="dialog-actions">
              <Button
                type="button"
                disabled={working}
                onClick={() => setVaultOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={disabled || vaultPath.trim() === meta.vaultPath}
              >
                {working ? "Moving files…" : "Move vault"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
function ImportModal({
  state,
  api,
  save,
  busy,
  onClose,
  onImported,
  initialAccount,
  editOnly = false,
  aiReady = false,
}) {
  const initialId = initialAccount || state.accounts[0]?.id || "new";
  const initialProfile = profileFor(state, initialId);
  const [step, setStep] = useState(editOnly ? 2 : 1),
    [file, setFile] = useState(null),
    [text, setText] = useState(""),
    [delimiter, setDelimiter] = useState(initialProfile?.delimiter || ","),
    [header, setHeader] = useState(initialProfile?.header || 1),
    [accountId, setAccountId] = useState(initialId),
    [accountName, setAccountName] = useState(""),
    [accountType, setAccountType] = useState("bank"),
    [statement, setStatement] = useState(
      initialProfile?.statement ||
        (state.accounts.find((a) => a.id === initialId)?.type === "credit"
          ? "credit"
          : "bank"),
    ),
    [mapping, setMapping] = useState(
      initialProfile
        ? profileMapping(initialProfile)
        : mappingDefaults(state.accounts.find((a) => a.id === initialId)?.type),
    ),
    [preview, setPreview] = useState(null),
    [error, setError] = useState(""),
    [skipInvalid, setSkipInvalid] = useState(false),
    [currencyConfirmed, setCurrencyConfirmed] = useState(!!initialProfile),
    [aiBusy, setAiBusy] = useState(false),
    [page, setPage] = useState(0),
    [needsEdit, setNeedsEdit] = useState(false);
  const [draftRules, setDraftRules] = useState([]);
  const savedProfile = profileFor(state, accountId);
  function applySaved(id, raw = text) {
    setAccountId(id);
    setError("");
    setNeedsEdit(false);
    const p = profileFor(state, id);
    const a = state.accounts.find((a) => a.id === id);
    setStatement(p?.statement || (a?.type === "credit" ? "credit" : "bank"));
    setCurrencyConfirmed(!!p);
    setSkipInvalid(false);
    if (p) {
      setDelimiter(p.delimiter);
      setHeader(p.header);
      setMapping(profileMapping(p));
      if (raw)
        try {
          setMapping(
            restoreMapping(p, parseCSV(raw, p.delimiter)[p.header - 1] || []),
          );
        } catch (e) {
          setNeedsEdit(true);
          setError(e.message);
        }
    } else {
      setDelimiter(",");
      setHeader(1);
      setMapping(mappingDefaults(a?.type));
    }
  }
  let rows = [];
  try {
    if (text) rows = parseCSV(text, delimiter);
  } catch {}
  const headers =
    rows[header - 1] ||
    (editOnly && savedProfile ? JSON.parse(savedProfile.headers) : []);
  const account =
    accountId === "new"
      ? { id: "pending", name: accountName.trim(), type: accountType }
      : state.accounts.find((a) => a.id === accountId);
  const change = (k, v) => setMapping((m) => ({ ...m, [k]: v }));
  async function readFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5e6) {
      setError("Choose a CSV smaller than 5 MB.");
      return;
    }
    const raw = await f.text();
    setFile(f);
    setText(raw);
    setError("");
    if (savedProfile) {
      applySaved(accountId, raw);
      return;
    }
    const first = raw.split("\n")[0];
    const delim = first.includes("\t")
      ? "\t"
      : first.split(";").length > first.split(",").length
        ? ";"
        : ",";
    setDelimiter(delim);
    try {
      const r = parseCSV(raw, delim);
      const h = r[0]?.map((v) => v.toLowerCase()) || [];
      const guess = (re, fallback) => {
        const i = h.findIndex((v) => re.test(v));
        return i < 0 ? fallback : i;
      };
      setMapping((m) => ({
        ...m,
        date: guess(/date/, 0),
        description: guess(/description|merchant|memo|payee/, 1),
        amount: guess(/amount/, 2),
        debit: guess(/debit|withdrawal/, 2),
        credit: guess(/credit|deposit/, 3),
      }));
    } catch (e) {
      setError(e.message);
    }
  }
  function buildPreview() {
    setError("");
    try {
      if (!file || !rows.length) throw Error("Choose a readable CSV first.");
      if (!account?.name)
        throw Error("Choose an account or enter a new account name.");
      if (
        accountId !== "new" &&
        (account.type === "credit") !== (statement === "credit")
      )
        throw Error(
          "The statement type must match the selected account. Choose the correct account or create a new one.",
        );
      if (!currencyConfirmed)
        throw Error(`Confirm that this statement is in ${state.currency}.`);
      const cols = [
        mapping.date,
        mapping.description,
        ...(mapping.layout === "single"
          ? [mapping.amount]
          : [mapping.debit, mapping.credit]),
      ];
      if (new Set(cols).size !== cols.length)
        throw Error("Choose a different column for each mapped field.");
      if (cols.some((i) => i < 0 || i >= headers.length))
        throw Error("Select valid columns for all fields.");
      const parsed = normalizeCSV(
        parseCSV(text, delimiter),
        { ...mapping, start: header },
        { ...account, type: statement === "credit" ? "credit" : "bank" },
        state.transactions,
      );
      parsed.transactions = localCategorize(parsed.transactions, state).map(
        (t) => ({ ...t, skip: t.duplicate }),
      );
      if (parsed.dateInference?.format)
        setMapping((m) => ({ ...m, dateFormat: parsed.dateInference.format }));
      setPreview(parsed);
      setPage(0);
      setStep(3);
    } catch (e) {
      setError(e.message);
    }
  }
  async function ai() {
    setError("");
    setAiBusy(true);
    try {
      const pending = preview.transactions.filter(
        (t) =>
          !t.skip &&
          t.category === "uncategorized" &&
          ["expense", "refund"].includes(t.kind),
      );
      let suggestions = [];
      for (let i = 0; i < pending.length; i += 100) {
        const result = await api("categorize", {
          transactions: pending
            .slice(i, i + 100)
            .map((t) => ({ id: t.id, description: t.description })),
        });
        suggestions.push(...result.suggestions);
      }
      setPreview((p) => ({
        ...p,
        transactions: p.transactions.map((t) => {
          const s = suggestions.find((s) => s.id === t.id);
          return s
            ? {
                ...t,
                category: s.category,
                review: true,
                source: "ai suggestion",
              }
            : t;
        }),
      }));
    } catch (e) {
      setError(e.message);
    } finally {
      setAiBusy(false);
    }
  }
  function update(id, patch) {
    const selected = {
      ...preview.transactions.find((t) => t.id === id),
      ...patch,
    };
    const shouldLearn =
      patch.source === "reviewed" &&
      selected.category !== "uncategorized" &&
      ["expense", "refund"].includes(selected.kind);
    const rule = shouldLearn ? makeMerchantRule(selected) : null;
    if (rule)
      setDraftRules((rules) => [
        ...rules.filter((r) => r.key !== rule.key),
        rule,
      ]);
    setPreview((p) => ({
      ...p,
      transactions: p.transactions.map((t) => {
        if (t.id === id) return selected;
        if (
          rule &&
          merchantKey(t.description) === rule.key &&
          ["expense", "refund"].includes(t.kind) &&
          (t.category === "uncategorized" ||
            ["learned", "ai suggestion"].includes(t.source))
        )
          return {
            ...t,
            category: rule.category,
            merchant: rule.merchant,
            source: "learned",
            review: false,
          };
        return t;
      }),
    }));
  }
  async function commit() {
    setError("");
    if (preview.errors.length && !skipInvalid) {
      setError("Review the invalid rows and confirm they can be skipped.");
      return;
    }
    const selected = preview.transactions.filter((t) => !t.skip);
    if (!selected.length) {
      setError("No new transactions selected.");
      return;
    }
    const newAccount =
      accountId === "new" ? { ...account, id: uid() } : account;
    const imported = selected.map(({ row, duplicate, skip, ...t }) => ({
      ...t,
      account: newAccount.id,
    }));
    if (
      await save(
        {
          ...state,
          accounts:
            accountId === "new"
              ? [...state.accounts, newAccount]
              : state.accounts,
          transactions: [...state.transactions, ...imported],
          merchantRules: [
            ...(state.merchantRules || []).filter(
              (r) =>
                !draftRules.some(
                  (d) =>
                    d.key === r.key &&
                    imported.some((t) => merchantKey(t.description) === d.key),
                ),
            ),
            ...draftRules.filter((r) =>
              imported.some((t) => merchantKey(t.description) === r.key),
            ),
          ],
          importProfiles: [
            ...(state.importProfiles || []).filter(
              (p) => p.account !== newAccount.id,
            ),
            makeProfile(
              newAccount.id,
              statement,
              delimiter,
              header,
              mapping,
              headers,
            ),
          ],
        },
        `${imported.length} transactions saved to your vault`,
      )
    ) {
      onImported(
        imported
          .map((t) => t.date)
          .sort()
          .at(-1),
      );
      onClose();
    }
  }
  const options = headers.map((h, i) => (
    <option value={i} key={i}>
      {i + 1}. {h || "(empty header)"}
    </option>
  ));
  return (
    <Modal
      wide
      title="Bring your money into focus"
      subtitle="A thoughtful import. You stay in control of every row."
      onClose={onClose}
    >
      <div className="import-steps">
        {["Choose statement", "Map columns", "Review & import"].map((s, i) => (
          <span
            key={s}
            className={
              step === i + 1 ? "current" : step > i + 1 ? "complete" : ""
            }
          >
            <b>{step > i + 1 ? <Check size={12} /> : i + 1}</b>
            {s}
          </span>
        ))}
      </div>
      <div className="form-body import-body">
        {step === 1 && (
          <>
            {savedProfile && (
              <div className="notice">
                <Check size={17} />
                <span>
                  Saved settings loaded for {account?.name}. Your columns, date
                  format, separators, and spending signs are remembered.
                </span>
                <Button onClick={() => setStep(2)}>Edit settings</Button>
              </div>
            )}
            <label className="file-drop">
              <span className="upload-icon">
                <Upload size={25} />
              </span>
              <strong>{file ? file.name : "Choose your CSV statement"}</strong>
              <span>
                {file
                  ? `${rows.length} rows detected · choose another file`
                  : "Export a CSV from your bank, then select it here. Up to 5 MB."}
              </span>
              <input
                aria-label="Upload CSV statement"
                type="file"
                accept=".csv,.tsv,text/csv,text/tab-separated-values"
                onChange={readFile}
              />
            </label>
            <div className="form-grid">
              <Field label="What kind of statement is this?">
                <select
                  value={statement}
                  onChange={(e) => {
                    setStatement(e.target.value);
                    setAccountType(
                      e.target.value === "credit" ? "credit" : "bank",
                    );
                    change(
                      "sign",
                      e.target.value === "credit"
                        ? "positive-expense"
                        : "negative-expense",
                    );
                  }}
                >
                  <option value="bank">Bank / debit account</option>
                  <option value="credit">Credit card</option>
                </select>
              </Field>
              <Field label="Which account does it belong to?">
                <select
                  value={accountId}
                  onChange={(e) => applySaved(e.target.value)}
                >
                  {state.accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                  <option value="new">+ Create a new account</option>
                </select>
              </Field>
            </div>
            {accountId === "new" && (
              <Field label="New account name">
                <input
                  maxLength={99}
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="e.g. Everyday Visa"
                />
              </Field>
            )}
            <div className="notice">
              <Info size={17} />
              <span>
                {statement === "credit"
                  ? "Card purchases count as spending. Credits default to refunds; card repayments are transfers. Review the preview to distinguish them."
                  : "Withdrawals default to spending and deposits to income. Transfers and refunds need the correct type in the preview."}
              </span>
            </div>
            <label className="check-row">
              <input
                type="checkbox"
                checked={currencyConfirmed}
                onChange={(e) => setCurrencyConfirmed(e.target.checked)}
              />
              This statement is in {state.currency}. Amounts are not
              currency-converted.
            </label>
          </>
        )}
        {step === 2 && (
          <>
            <div className="form-grid three">
              <Field
                label="Header row"
                hint="Skip bank titles or introductory rows."
              >
                <input
                  type="number"
                  min="1"
                  max={Math.max(rows.length, 100000)}
                  value={header}
                  onChange={(e) => setHeader(Math.max(1, +e.target.value))}
                />
              </Field>
              <Field label="Column separator">
                <select
                  value={delimiter}
                  onChange={(e) => setDelimiter(e.target.value)}
                >
                  <option value=",">Comma (,)</option>
                  <option value=";">Semicolon (;)</option>
                  <option value={"\t"}>Tab</option>
                </select>
              </Field>
              <Field label="Decimal separator">
                <select
                  value={mapping.decimal}
                  onChange={(e) => change("decimal", e.target.value)}
                >
                  <option value=".">Point · 1,234.56</option>
                  <option value=",">Comma · 1.234,56</option>
                </select>
              </Field>
            </div>
            <div className="csv-sample table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Row</th>
                    {headers.map((h, i) => (
                      <th key={i}>{h || `Column ${i + 1}`}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(header, header + 3).map((r, i) => (
                    <tr key={i}>
                      <td>{header + i + 1}</td>
                      {r.map((v, j) => (
                        <td key={j}>{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="form-grid">
              <Field label="Date column">
                <select
                  value={mapping.date}
                  onChange={(e) => change("date", +e.target.value)}
                >
                  {options}
                </select>
              </Field>
              <Field label="Description column">
                <select
                  value={mapping.description}
                  onChange={(e) => change("description", +e.target.value)}
                >
                  {options}
                </select>
              </Field>
              <Field label="Date format">
                <select
                  value={mapping.dateFormat}
                  onChange={(e) => change("dateFormat", e.target.value)}
                >
                  {dateModes.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Date language">
                <select
                  value={mapping.dateLocale}
                  onChange={(e) => change("dateLocale", e.target.value)}
                >
                  {dateLocales.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
              {mapping.dateFormat === "CUSTOM" && (
                <Field
                  label="Custom date format"
                  hint="Examples: DD MMM YYYY · MMM D, YYYY · DD/MM/YYYY HH:mm:ss. Tokens are case-sensitive."
                >
                  <input
                    value={mapping.customDateFormat}
                    onChange={(e) => change("customDateFormat", e.target.value)}
                    placeholder="DD MMM YYYY"
                  />
                </Field>
              )}
              <Field
                label="Year for dates without a year (optional)"
                hint="Only used for yearless dates. For December–January statements, import each year separately or include years in the CSV."
              >
                <input
                  type="number"
                  min="1900"
                  max="2200"
                  value={mapping.statementYear}
                  onChange={(e) => change("statementYear", e.target.value)}
                  placeholder="e.g. 2026"
                />
              </Field>
              <Field label="Amount layout">
                <select
                  value={mapping.layout}
                  onChange={(e) => change("layout", e.target.value)}
                >
                  <option value="single">One amount column</option>
                  <option value="split">Separate debit & credit columns</option>
                </select>
              </Field>
              {mapping.layout === "single" ? (
                <>
                  <Field label="Amount column">
                    <select
                      value={mapping.amount}
                      onChange={(e) => change("amount", +e.target.value)}
                    >
                      {options}
                    </select>
                  </Field>
                  <Field label="How are purchases shown?">
                    <select
                      value={mapping.sign}
                      onChange={(e) => change("sign", e.target.value)}
                    >
                      <option value="negative-expense">
                        Negative = spending
                      </option>
                      <option value="positive-expense">
                        Positive = spending
                      </option>
                    </select>
                  </Field>
                </>
              ) : (
                <>
                  <Field label="Debit / spending column">
                    <select
                      value={mapping.debit}
                      onChange={(e) => change("debit", +e.target.value)}
                    >
                      {options}
                    </select>
                  </Field>
                  <Field label="Credit / incoming column">
                    <select
                      value={mapping.credit}
                      onChange={(e) => change("credit", +e.target.value)}
                    >
                      {options}
                    </select>
                  </Field>
                </>
              )}
            </div>
            <div className="notice">
              <Info size={17} />
              <span>
                Check the preview against a known purchase and payment. Banks
                use different sign conventions, even for credit cards. Named
                months (13 Oct 2026), numeric separators, compact dates, and
                timestamps are supported. Two-digit years use 2000–2068 for
                00–68 and 1969–1999 for 69–99. Timestamps retain the printed
                calendar date; Unix timestamps use UTC.
              </span>
            </div>
          </>
        )}
        {step === 2 && (
          <div className="date-examples">
            <strong>Date preview</strong>
            {rows.slice(header, header + 5).map((r, i) => {
              let result;
              try {
                result = parseDate(
                  r[mapping.date],
                  (mapping.dateFormat === "AUTO"
                    ? inferDateOrder(
                        rows.slice(header).map((row) => row[mapping.date]),
                      )?.format
                    : null) || mapping.dateFormat,
                  mapping,
                );
              } catch (e) {
                result = e.message;
              }
              return (
                <p key={i}>
                  <code>{r[mapping.date] || "(empty)"}</code> → {result}
                </p>
              );
            })}
            {!rows.length && (
              <p>
                Upload your next statement to preview dates. These settings
                apply to future imports only.
              </p>
            )}
          </div>
        )}
        {step === 3 && preview && (
          <>
            {preview.dateInference?.format && (
              <p className="notice">
                Detected{" "}
                {preview.dateInference.format === "MDY"
                  ? "month-first"
                  : "day-first"}{" "}
                dates from {preview.dateInference.example}. This date order will
                be saved with the account’s import settings.
              </p>
            )}
            {preview.dateInference?.conflict && (
              <p className="notice danger">
                This file contains conflicting date orders. Edit the import
                settings and verify the dates before importing.
              </p>
            )}
            <div className="review-summary">
              <div>
                <h3>
                  {preview.transactions.filter((t) => !t.skip).length}{" "}
                  transactions selected
                </h3>
                <p>
                  {preview.transactions.filter((t) => t.duplicate).length}{" "}
                  possible duplicates skipped by default ·{" "}
                  {preview.errors.length} invalid rows
                </p>
              </div>
              {aiReady &&
                preview.transactions.some(
                  (t) =>
                    !t.skip &&
                    t.category === "uncategorized" &&
                    ["expense", "refund"].includes(t.kind),
                ) && (
                  <Button
                    disabled={
                      aiBusy ||
                      !preview.transactions.some(
                        (t) =>
                          !t.skip &&
                          t.category === "uncategorized" &&
                          ["expense", "refund"].includes(t.kind),
                      )
                    }
                    onClick={ai}
                  >
                    <Sparkles size={16} />
                    {aiBusy ? "Finding categories…" : "Suggest with OpenAI"}
                  </Button>
                )}
            </div>
            {aiReady && (
              <p className="form-note">
                OpenAI sends selected uncategorized descriptions, category
                labels, and reviewed examples to your API account. Suggestions
                stay marked for review. No amounts or balances are sent.
              </p>
            )}
            <details className="merchant-import-groups" open>
              <summary>Categorize matching merchants together</summary>
              <MerchantGroupFields
                state={state}
                transactions={preview.transactions}
                disabled={aiBusy || busy}
                onChange={(key, category) => {
                  const next = applyGroupCategory(
                    preview.transactions,
                    key,
                    category,
                  );
                  const chosen = next.find(
                    (t) => !t.skip && merchantGroupKey(t) === key,
                  );
                  if (chosen && category !== "uncategorized") {
                    const rule = makeMerchantRule(chosen);
                    setDraftRules((rules) => [
                      ...rules.filter((r) => r.key !== rule.key),
                      rule,
                    ]);
                  } else
                    setDraftRules((rules) =>
                      rules.filter((r) => r.key !== key),
                    );
                  setPreview({ ...preview, transactions: next });
                }}
              />
            </details>
            {preview.errors.length > 0 && (
              <div className="invalid-rows">
                <strong>These rows could not be read</strong>
                <ul>
                  {preview.errors.map((e) => (
                    <li key={e.row}>
                      Row {e.row}: {e.message}
                    </li>
                  ))}
                </ul>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={skipInvalid}
                    onChange={(e) => setSkipInvalid(e.target.checked)}
                  />
                  I understand these rows will not be imported. Skip them.
                </label>
              </div>
            )}
            <div className="table-scroll preview-table">
              <table>
                <thead>
                  <tr>
                    <th>Use</th>
                    <th>Date / description</th>
                    <th>Amount</th>
                    <th>Type</th>
                    <th>Category</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.transactions
                    .slice(page * 25, page * 25 + 25)
                    .map((t) => (
                      <tr key={t.id} className={t.skip ? "skipped" : ""}>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Import row ${t.row}`}
                            checked={!t.skip}
                            onChange={(e) =>
                              update(t.id, { skip: !e.target.checked })
                            }
                          />
                        </td>
                        <td>
                          <strong>
                            {t.merchant ||
                              extractMerchant(t.description).merchant}
                          </strong>
                          <details className="statement-details">
                            <summary>Statement details</summary>
                            <p>{t.description}</p>
                            {t.location && <p>Location: {t.location}</p>}
                            {t.reference && <p>Reference: {t.reference}</p>}
                          </details>
                          <small>
                            {t.date} · row {t.row}
                          </small>
                        </td>
                        <td className="number">
                          {money(t.amount, state.currency)}
                        </td>
                        <td>
                          <select
                            aria-label={`Type for row ${t.row}`}
                            value={t.kind}
                            onChange={(e) =>
                              update(t.id, {
                                kind: e.target.value,
                                review: false,
                              })
                            }
                          >
                            {kinds.map((k) => (
                              <option key={k}>{k}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                            aria-label={`Category for row ${t.row}`}
                            value={t.category}
                            onChange={(e) =>
                              update(t.id, {
                                category: e.target.value,
                                review: false,
                                source: "reviewed",
                              })
                            }
                          >
                            {state.categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {categoryLabel(state.categories, c.id)}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          {t.duplicate ? (
                            <span className="review-pill">
                              Possible duplicate
                            </span>
                          ) : t.review ? (
                            <button
                              className="review-pill"
                              onClick={() =>
                                update(t.id, {
                                  review: false,
                                  source: "reviewed",
                                })
                              }
                            >
                              Confirm{" "}
                              {t.source === "ai suggestion" ? "AI" : "type"}
                            </button>
                          ) : t.source === "learned" ? (
                            <span className="chip">Learned</span>
                          ) : (
                            <Check size={14} />
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span>
                Page {page + 1} of{" "}
                {Math.max(1, Math.ceil(preview.transactions.length / 25))}
              </span>
              <Button disabled={page === 0} onClick={() => setPage(page - 1)}>
                <ChevronLeft size={15} />
              </Button>
              <Button
                disabled={(page + 1) * 25 >= preview.transactions.length}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight size={15} />
              </Button>
            </div>
            <p className="form-note">
              Possible duplicates match account, date, description, and amount.
              Repeated identical purchases in the same file are retained. Select
              a skipped row only if it is a separate transaction.
            </p>
          </>
        )}
        {error && (
          <div className="notice danger" role="alert">
            <AlertCircle size={16} />
            {error}
          </div>
        )}
      </div>
      <div className="dialog-actions">
        <Button
          disabled={aiBusy || busy}
          onClick={() =>
            step === 1 || editOnly ? onClose() : setStep(step - 1)
          }
        >
          {step === 1 ? "Cancel" : "Back"}
        </Button>
        {step === 1 ? (
          <Button
            variant="primary"
            disabled={!file || !account?.name || !currencyConfirmed}
            onClick={() => {
              if (savedProfile && !needsEdit) buildPreview();
              else {
                setError("");
                setStep(2);
              }
            }}
          >
            {savedProfile && !needsEdit
              ? "Preview with saved settings"
              : "Map columns"}{" "}
            <ArrowRight size={16} />
          </Button>
        ) : step === 2 && editOnly ? (
          <Button
            variant="primary"
            disabled={busy}
            onClick={async () => {
              setError("");
              try {
                if (
                  await save(
                    {
                      ...state,
                      importProfiles: [
                        ...(state.importProfiles || []).filter(
                          (p) => p.account !== accountId,
                        ),
                        makeProfile(
                          accountId,
                          statement,
                          delimiter,
                          header,
                          mapping,
                          headers,
                        ),
                      ],
                    },
                    "Import settings saved",
                  )
                )
                  onClose();
              } catch (e) {
                setError(e.message);
              }
            }}
          >
            Save import settings
          </Button>
        ) : step === 2 ? (
          <Button variant="primary" onClick={buildPreview}>
            Preview transactions <ArrowRight size={16} />
          </Button>
        ) : (
          <Button
            variant="primary"
            disabled={
              busy || aiBusy || !preview?.transactions.some((t) => !t.skip)
            }
            onClick={commit}
          >
            <Check size={16} />
            {busy ? "Saving…" : "Import selected"}
          </Button>
        )}
      </div>
    </Modal>
  );
}

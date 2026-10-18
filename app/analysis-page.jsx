"use client";
import { useMemo, useState } from "react";
import { Pin, PinOff, X, SlidersHorizontal, BarChart3 } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { counted } from "../public/record-management.js";
import { analysisData } from "../public/analysis.js";
import { categoryLabel } from "../public/money-model.js";
const charts = [
  {
    id: "cashflow",
    title: "Money in, money out",
    note: "Monthly income, net spending, and recorded surplus across all categories. Transfers excluded.",
  },
  {
    id: "category-trend",
    title: "How your spending mix changes",
    note: "Top five category groups plus the rest. Subcategories roll into their parent; refunds reduce spending.",
  },
  {
    id: "budget-trend",
    title: "Your plan over time",
    note: "Selected category group against its monthly plan. Temporary overrides are included.",
  },
  {
    id: "budget-actual",
    title: "Which budgets need attention?",
    note: "Selected date range. Combined groups and their child targets are shown separately; do not add these rows together.",
  },
  {
    id: "merchants",
    title: "Where your money goes",
    note: "Top ten merchants by net spending in the selected range. Names use your cleaned merchant details.",
  },
  {
    id: "daily",
    title: "Your spending rhythm",
    note: "Daily net spending in the selected range. Negative days reflect refunds.",
  },
];
const tooltip = {
  contentStyle: {
    background: "var(--card)",
    border: "1px solid var(--line)",
    borderRadius: 10,
    color: "var(--ink)",
  },
  labelStyle: { color: "var(--ink)" },
  itemStyle: { color: "var(--ink)" },
  cursor: { fill: "var(--chart-hover)", stroke: "var(--purple)" },
};
export default function AnalysisPage({ state, start, end, save, busy, demo }) {
  const [window, setWindow] = useState("6"),
    [category, setCategory] = useState("all"),
    [controls, setControls] = useState(false);
  const trendStart = useMemo(() => {
    if (window === "range") return start;
    const d = new Date(end.slice(0, 7) + "-01T00:00:00Z");
    d.setUTCMonth(d.getUTCMonth() - Number(window) + 1);
    return d.toISOString().slice(0, 10);
  }, [window, start, end]);
  const data = useMemo(
    () => analysisData(state, start, end, trendStart, category),
    [state, start, end, trendStart, category],
  );
  const fmt = (v) =>
    new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: state.currency,
      maximumFractionDigits: 2,
    }).format(v);
  const compact = (v) =>
    new Intl.NumberFormat("en-CA", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(v);
  const preferences = state.chartPreferences || [];
  const preference = (id) =>
    preferences.find((p) => p.id === id) || {
      id,
      visibility: "shown",
      position: "normal",
    };
  const change = (id, patch) =>
    save(
      {
        ...state,
        chartPreferences: [
          ...preferences.filter((p) => p.id !== id),
          { ...preference(id), ...patch },
        ],
      },
      "Analysis layout saved",
    );
  const visible = charts
    .filter((c) => preference(c.id).visibility === "shown")
    .sort(
      (a, b) =>
        Number(preference(b.id).position === "pinned") -
        Number(preference(a.id).position === "pinned"),
    );
  const common = (
    <>
      <CartesianGrid
        vertical={false}
        stroke="var(--line)"
        strokeDasharray="3 3"
      />
      <XAxis
        dataKey="label"
        tick={{ fontSize: 10, fill: "var(--muted)" }}
        minTickGap={20}
        axisLine={false}
        tickLine={false}
      />
      <YAxis
        width={48}
        tickFormatter={compact}
        tick={{ fontSize: 10, fill: "var(--muted)" }}
        axisLine={false}
        tickLine={false}
      />
      <Tooltip {...tooltip} formatter={(v) => fmt(v)} />
      <Legend wrapperStyle={{ fontSize: 11 }} />
    </>
  );
  function chart(id) {
    if (id === "cashflow")
      return (
        <BarChart data={data.months}>
          {common}
          <Bar
            dataKey="Income"
            fill="var(--chart-income)"
            radius={[3, 3, 0, 0]}
          />
          <Bar dataKey="Spending" fill="var(--purple)" radius={[3, 3, 0, 0]} />
          <Bar
            dataKey="Surplus"
            fill="var(--chart-surplus)"
            radius={[3, 3, 0, 0]}
          />
        </BarChart>
      );
    if (id === "category-trend")
      return (
        <BarChart data={data.composition} stackOffset="sign">
          {common}
          {data.roots.map((c) => (
            <Bar
              key={c.id}
              dataKey={c.id}
              name={c.name}
              fill={c.color}
              stackId="mix"
            />
          ))}
          <Bar
            dataKey="other"
            name="Other / no category"
            fill="var(--muted)"
            stackId="mix"
          />
        </BarChart>
      );
    if (id === "budget-trend")
      return (
        <LineChart data={data.months}>
          {common}
          <Line
            dataKey="Selected"
            name="Net spending"
            stroke="var(--purple)"
            strokeWidth={3}
            dot={false}
          />
          <Line
            dataKey="Budget"
            name="Budget"
            stroke="var(--muted)"
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
          />
        </LineChart>
      );
    if (id === "budget-actual" || id === "merchants") {
      const rows = id === "merchants" ? data.merchants : data.budgets;
      return (
        <BarChart data={rows} layout="vertical" margin={{ left: 0, right: 16 }}>
          <CartesianGrid horizontal={false} stroke="var(--line)" />
          <XAxis
            type="number"
            tickFormatter={compact}
            tick={{ fontSize: 10, fill: "var(--muted)" }}
          />
          <YAxis
            dataKey="name"
            type="category"
            width={110}
            tick={{ fontSize: 10, fill: "var(--muted)" }}
            tickFormatter={(v) => (v.length > 18 ? v.slice(0, 17) + "…" : v)}
          />
          <Tooltip {...tooltip} formatter={(v) => fmt(v)} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {id === "budget-actual" && (
            <Bar dataKey="Budget" fill="var(--chart-income)" />
          )}
          <Bar dataKey="Spending" name="Net spending" fill="var(--purple)" />
        </BarChart>
      );
    }
    return (
      <LineChart data={data.daily}>
        <CartesianGrid vertical={false} stroke="var(--line)" />
        <XAxis
          dataKey="date"
          minTickGap={30}
          tickFormatter={(v) => v.slice(5)}
          tick={{ fontSize: 10, fill: "var(--muted)" }}
        />
        <YAxis
          width={48}
          tickFormatter={compact}
          tick={{ fontSize: 10, fill: "var(--muted)" }}
        />
        <Tooltip {...tooltip} formatter={(v) => fmt(v)} />
        <Line
          dataKey="Spending"
          name="Net spending"
          stroke="var(--purple)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    );
  }
  return (
    <>
      <div className="analysis-controls panel">
        <label>
          Trend window
          <select value={window} onChange={(e) => setWindow(e.target.value)}>
            <option value="6">Last 6 months</option>
            <option value="12">Last 12 months</option>
            <option value="range">Selected date range</option>
          </select>
        </label>
        <label>
          Compare category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="all">All categories</option>
            {state.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {categoryLabel(state.categories, c.id)}
              </option>
            ))}
          </select>
        </label>
        <button
          className="btn"
          onClick={() => setControls(!controls)}
          aria-expanded={controls}
        >
          <SlidersHorizontal size={16} /> Customize charts
        </button>
        <p>
          Monthly trends: {trendStart} to {end}. Rankings and daily detail:{" "}
          {start} to {end}. Category selection applies to plan, budget,
          merchant, and daily charts.
        </p>
      </div>
      {controls && (
        <section className="panel chart-library">
          <h2>Your chart library</h2>
          <p className="body-copy">
            Pin charts to keep them at the top. Hidden charts can be restored
            here.
          </p>
          {charts.map((c) => (
            <label key={c.id}>
              <input
                type="checkbox"
                disabled={busy || !!demo}
                checked={preference(c.id).visibility === "shown"}
                onChange={(e) =>
                  change(c.id, {
                    visibility: e.target.checked ? "shown" : "hidden",
                  })
                }
              />
              {c.title}
            </label>
          ))}
        </section>
      )}
      <div className="analysis-facts">
        <article>
          <span>Average purchase</span>
          <strong>{fmt(data.average / 100)}</strong>
          <small>{counted(data.purchases, "purchase")} in selected range</small>
        </article>
        <article>
          <span>Largest merchant</span>
          <strong>{data.merchants[0]?.name || "No purchases yet"}</strong>
          <small>
            {data.merchants[0]
              ? `${fmt(data.merchants[0].Spending)} net · ${counted(data.merchants[0].purchases, "purchase")}`
              : "Import a statement to compare merchants"}
          </small>
        </article>
        <article>
          <span>Over-budget categories</span>
          <strong>
            {data.budgets.filter((c) => c.Spending > c.Budget).length}
          </strong>
          <small>Group and child targets may overlap</small>
        </article>
        <article>
          <span>Category coverage</span>
          <strong>{data.missing} unassigned</strong>
          <small>Assign categories to improve comparisons</small>
        </article>
      </div>
      <p className="analysis-caveat">
        Based only on recorded transactions. Zero activity may mean missing
        statements. Partial months and custom ranges are not full-month
        comparisons; budget limits are prorated by calendar days. Recurring
        limits reflect your current plan.
      </p>
      <div className="analysis-grid">
        {visible.map((c) => {
          const pinned = preference(c.id).position === "pinned";
          const empty =
            c.id === "merchants"
              ? !data.merchants.length
              : c.id === "budget-actual"
                ? !data.budgets.length
                : c.id === "daily"
                  ? !data.records
                  : !data.months.some((m) => m.records);
          return (
            <section
              className={`panel analysis-chart ${pinned ? "pinned" : ""}`}
              key={c.id}
            >
              <header>
                <div>
                  {pinned && (
                    <span className="pinned-label">
                      <Pin size={11} /> PINNED
                    </span>
                  )}
                  <h2>{c.title}</h2>
                </div>
                <div className="chart-actions">
                  <button
                    className="icon-button"
                    disabled={busy || !!demo}
                    aria-label={`${pinned ? "Unpin" : "Pin"} ${c.title}`}
                    onClick={() =>
                      change(c.id, { position: pinned ? "normal" : "pinned" })
                    }
                  >
                    {pinned ? <PinOff size={17} /> : <Pin size={17} />}
                  </button>
                  <button
                    className="icon-button"
                    disabled={busy || !!demo}
                    aria-label={`Hide ${c.title}`}
                    onClick={() => change(c.id, { visibility: "hidden" })}
                  >
                    <X size={17} />
                  </button>
                </div>
              </header>
              <p>{c.note}</p>
              {empty ? (
                <div className="analysis-empty">
                  <BarChart3 size={28} />
                  <span>
                    {c.id === "budget-actual"
                      ? "Set category budgets to compare your plan."
                      : "No matching records in this range."}
                  </span>
                </div>
              ) : (
                <div
                  className="analysis-plot"
                  style={{
                    height: ["merchants", "budget-actual"].includes(c.id)
                      ? Math.max(
                          280,
                          (c.id === "merchants"
                            ? data.merchants.length
                            : data.budgets.length) *
                            42 +
                            60,
                        )
                      : 290,
                  }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    {chart(c.id)}
                  </ResponsiveContainer>
                </div>
              )}
            </section>
          );
        })}
      </div>
      {!visible.length && (
        <div className="panel analysis-empty">
          All charts are hidden. Open Customize charts to bring them back.
        </div>
      )}
    </>
  );
}

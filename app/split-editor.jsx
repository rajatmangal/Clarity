"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  parseSplitValue,
  percentageAmounts,
  splitBalance,
} from "../public/transaction-splits.js";
import { categoryLabel } from "../public/money-model.js";

export default function SplitEditor({
  rows,
  setRows,
  mode,
  setMode,
  total,
  currency,
  categories,
  Button,
  Field,
}) {
  const [modeError, setModeError] = useState("");
  const money = (n) =>
    new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(
      n / 100,
    );
  const values = rows.map((r) => {
    try {
      return parseSplitValue(r.value);
    } catch {
      return 0;
    }
  });
  const target = mode === "percent" ? 10000 : total;
  const { remaining, over } = splitBalance(total, rows, mode);
  const update = (id, key, value) =>
    setRows(rows.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
  let rounded = [];
  if (mode === "percent") {
    try {
      rounded = percentageAmounts(total, values);
    } catch {}
  }
  function changeMode(next) {
    if (next === mode) return;
    setModeError("");
    if (
      next === "percent" &&
      total > 0 &&
      values.some((v) => v > 0 && Number(((v / total) * 100).toFixed(2)) === 0)
    ) {
      setModeError(
        "An allocation is too small to express with two decimal places of percentage. Keep amount entry to preserve it exactly.",
      );
      return;
    }
    const amounts =
      mode === "percent"
        ? rounded.length
          ? rounded
          : values.map((v) => Math.round((total * v) / 10000))
        : values;
    setRows(
      rows.map((r, i) => ({
        ...r,
        value:
          amounts[i] > 0 && total > 0
            ? (next === "percent"
                ? (amounts[i] / total) * 100
                : amounts[i] / 100
              ).toFixed(2)
            : "",
      })),
    );
    setMode(next);
  }
  return (
    <section className="split-editor" aria-label="Category allocations">
      <div className="split-heading">
        <h3>Divide this {money(total)} transaction</h3>
        <Field label="Enter allocations as">
          <select value={mode} onChange={(e) => changeMode(e.target.value)}>
            <option value="amount">Amounts ({currency})</option>
            <option value="percent">Percentages</option>
          </select>
        </Field>
      </div>
      <p className="form-note">
        These allocations replace the single category. The original transaction
        stays intact for statement matching and account totals.
      </p>
      {modeError && (
        <p className="notice danger" role="alert">
          {modeError}
        </p>
      )}
      {rows.map((row, i) => (
        <div className="split-allocation" key={row.id}>
          <div className="split-allocation-heading">
            <strong>Allocation {i + 1}</strong>
            <Button
              type="button"
              disabled={rows.length <= 2}
              aria-label={`Remove allocation ${i + 1}`}
              onClick={() => setRows(rows.filter((r) => r.id !== row.id))}
            >
              <Trash2 size={15} />
            </Button>
          </div>
          <div className="form-grid">
            <Field label={`Category for allocation ${i + 1}`}>
              <select
                required
                value={row.category === "uncategorized" ? "" : row.category}
                onChange={(e) => update(row.id, "category", e.target.value)}
              >
                <option value="" disabled>
                  Choose a category
                </option>
                {categories
                  .filter((c) => c.id !== "uncategorized")
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {categoryLabel(categories, c.id)}
                    </option>
                  ))}
              </select>
            </Field>
            <Field
              label={`${mode === "percent" ? "Percentage" : `Amount (${currency})`} for allocation ${i + 1}`}
            >
              <input
                type="number"
                min="0.01"
                step="0.01"
                max={mode === "percent" ? "100" : undefined}
                value={row.value}
                onChange={(e) => update(row.id, "value", e.target.value)}
              />
            </Field>
          </div>
          <div className="split-remainder-action">
            <Button
              type="button"
              disabled={
                target -
                  values.reduce(
                    (n, v, index) => n + (index === i ? 0 : v),
                    0,
                  ) <=
                0
              }
              onClick={() =>
                update(
                  row.id,
                  "value",
                  (
                    (target -
                      values.reduce(
                        (n, v, index) => n + (index === i ? 0 : v),
                        0,
                      )) /
                    100
                  ).toFixed(2),
                )
              }
            >
              Assign remaining here
            </Button>
            {rounded[i] !== undefined && (
              <span>{money(rounded[i])} after rounding</span>
            )}
          </div>
          <Field label={`Note for allocation ${i + 1} (optional)`}>
            <input
              maxLength={500}
              value={row.note}
              onChange={(e) => update(row.id, "note", e.target.value)}
            />
          </Field>
        </div>
      ))}
      <div className="split-footer">
        <Button
          type="button"
          disabled={rows.length >= 100}
          onClick={() =>
            setRows([
              ...rows,
              { id: crypto.randomUUID(), category: "", value: "", note: "" },
            ])
          }
        >
          <Plus size={15} />
          Add allocation
        </Button>
        <p role="status" aria-live="polite">
          <strong>
            {remaining === 0
              ? values.every((v) => v > 0) &&
                rows.every((r) => r.category && r.category !== "uncategorized")
                ? "Fully allocated"
                : "Finish allocation details"
              : `${remaining < 0 ? "Over allocated" : "Left to allocate"}: ${mode === "percent" ? (Math.abs(remaining) / 100).toFixed(2) + "%" : money(Math.abs(remaining))}`}
          </strong>
        </p>
      </div>
      {over && (
        <p className="notice danger" role="alert">
          {mode === "percent"
            ? `Percentages exceed 100% by ${(Math.abs(remaining) / 100).toFixed(2)}%.`
            : `Allocations exceed the ${money(total)} transaction total by ${money(Math.abs(remaining))}.`}{" "}
          Reduce an allocation before saving.
        </p>
      )}
      {mode === "percent" && (
        <p className="form-note">
          Percentages must total exactly 100%. Rounding is distributed to keep
          every cent; the exact amounts shown above are saved. Switching entry
          modes can round the allocation values—check them before saving.
        </p>
      )}
    </section>
  );
}

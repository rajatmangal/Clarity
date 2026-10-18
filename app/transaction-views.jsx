"use client";
import { useState } from "react";
import { Bookmark, Plus, Settings2, Trash2, X } from "lucide-react";
import { putSavedView, viewFilters } from "../public/transaction-tools.js";
import { categoryLabel } from "../public/money-model.js";

export default function TransactionViews({
  state,
  current,
  onApply,
  save,
  busy,
  demo,
  today,
  Modal,
  Button,
  Field,
}) {
  const [active, setActive] = useState(""),
    [dialog, setDialog] = useState(null),
    [name, setName] = useState(""),
    [dates, setDates] = useState("current"),
    [error, setError] = useState(""),
    [remove, setRemove] = useState(false);
  const views = state.savedViews || [],
    selected = views.find((v) => v.id === active);
  const effective = selected ? viewFilters(selected, today) : null;
  const modified =
    effective &&
    Object.keys(effective).some((key) => effective[key] !== current[key]);
  const missingCategory =
    current.category !== "all" &&
    current.category !== "" &&
    !state.categories.some((c) => c.id === current.category);
  const missingAccount =
    current.account !== "all" &&
    current.account !== "" &&
    !state.accounts.some((a) => a.id === current.account);
  function open(existing) {
    setDialog(existing ? { id: existing.id } : { id: null });
    setName(existing?.name || "");
    setDates(existing?.dateMode || "current");
    setError("");
    setRemove(false);
  }
  function apply(view) {
    setActive(view?.id || "");
    onApply(
      view
        ? viewFilters(view, today)
        : { search: "", type: "all", category: "all", account: "all" },
      view?.dateMode,
    );
  }
  const typeNames = {
    all: "All types",
    review: "Needs review",
    reviewed: "Reviewed",
  };
  return (
    <>
      <div className="transaction-view-bar">
        <div className="view-heading">
          <Bookmark size={17} />
          <div>
            <strong>Your views</strong>
            <small>Keep useful filters a click away.</small>
          </div>
        </div>
        <div className="view-controls">
          <select
            aria-label="Saved transaction views"
            value={selected?.id || ""}
            onChange={(e) => apply(views.find((v) => v.id === e.target.value))}
          >
            <option value="">All transactions / custom filters</option>
            {views.map((v) => (
              <option value={v.id} key={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          {selected && (
            <Button
              disabled={busy || !!demo}
              onClick={() => open(selected)}
              aria-label={`Edit saved view ${selected.name}`}
            >
              <Settings2 size={15} />
              Manage
            </Button>
          )}
          <Button disabled={busy || !!demo} onClick={() => open(null)}>
            <Plus size={15} />
            Save view
          </Button>
        </div>
        <div className="view-shortcuts">
          <button
            type="button"
            onClick={() => {
              setActive("");
              onApply({
                search: "",
                type: "review",
                category: "all",
                account: "all",
              });
            }}
          >
            Needs review
          </button>
          <button
            type="button"
            onClick={() => {
              setActive("");
              onApply({
                search: "",
                type: "all",
                category: "uncategorized",
                account: "all",
              });
            }}
          >
            Uncategorized
          </button>
          <button type="button" onClick={() => apply(null)}>
            <X size={12} />
            Clear filters
          </button>
          {modified && (
            <span className="view-adjusted">
              Filters adjusted · saved view unchanged
            </span>
          )}
        </div>
      </div>
      {(missingCategory || missingAccount) && (
        <p className="notice danger" role="alert">
          This view refers to{" "}
          {missingCategory && missingAccount
            ? "a category and account that were removed"
            : missingCategory
              ? "a category that was removed"
              : "an account that was removed"}
          . No matching records are shown for that filter. Choose a replacement
          below, then Manage → Save changes.
        </p>
      )}
      {dialog && (
        <Modal
          title={dialog.id ? "Edit saved view" : "Save this view"}
          subtitle="Save your filters, then reuse them whenever you need."
          onClose={() => {
            if (!busy) setDialog(null);
          }}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              try {
                const view = {
                  id: dialog.id || crypto.randomUUID(),
                  name: name.trim(),
                  search: current.search,
                  type: current.type,
                  category: current.category,
                  account: current.account,
                  dateMode: dates,
                  start: dates === "range" ? current.start : "",
                  end: dates === "range" ? current.end : "",
                };
                if (
                  await save(
                    putSavedView(state, view),
                    "Saved view updated",
                    setError,
                  )
                ) {
                  setActive(view.id);
                  onApply(viewFilters(view, today), view.dateMode);
                  setDialog(null);
                }
              } catch (e) {
                setError(e.message);
              }
            }}
          >
            <div className="form-body saved-view-form">
              {error && (
                <p className="notice danger" role="alert">
                  {error}
                </p>
              )}
              <Field label="View name">
                <input
                  aria-label="View name"
                  required
                  maxLength={60}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Groceries this month"
                  disabled={busy}
                  autoFocus
                />
              </Field>
              <Field label="Dates">
                <select
                  aria-label="Dates"
                  disabled={busy}
                  value={dates}
                  onChange={(e) => setDates(e.target.value)}
                >
                  <option value="current">
                    Follow the dashboard’s selected range
                  </option>
                  <option value="month">
                    This month · moves forward automatically
                  </option>
                  <option value="year">
                    This year · moves forward automatically
                  </option>
                  <option value="range">
                    Keep this exact range · {current.start} to {current.end}
                  </option>
                </select>
              </Field>
              <div className="saved-view-summary">
                <strong>Filters to remember</strong>
                <dl>
                  <div>
                    <dt>Search</dt>
                    <dd>{current.search || "Any merchant or description"}</dd>
                  </div>
                  <div>
                    <dt>Type / status</dt>
                    <dd>{typeNames[current.type] || current.type}</dd>
                  </div>
                  <div>
                    <dt>Category</dt>
                    <dd>
                      {current.category === "all"
                        ? "All categories"
                        : missingCategory
                          ? "Removed category"
                          : categoryLabel(state.categories, current.category)}
                    </dd>
                  </div>
                  <div>
                    <dt>Account</dt>
                    <dd>
                      {current.account === "all"
                        ? "All accounts"
                        : state.accounts.find((a) => a.id === current.account)
                            ?.name ||
                          (missingAccount ? "Removed account" : "No account")}
                    </dd>
                  </div>
                </dl>
              </div>
              <p className="form-note">
                Only filters are saved. Transactions, selections, and balances
                are not copied. To change a filter, close this dialog and adjust
                it on the page.
              </p>
              {remove && (
                <p className="notice danger" role="alert">
                  Delete “{selected?.name}”? This removes the saved view only.
                  Your transactions stay intact.
                </p>
              )}
            </div>
            <div className="dialog-actions view-dialog-actions">
              {dialog.id && (
                <Button
                  type="button"
                  variant="danger-button"
                  disabled={busy}
                  onClick={async () => {
                    if (!remove) {
                      setRemove(true);
                      return;
                    }
                    if (
                      await save(
                        {
                          ...state,
                          savedViews: views.filter((v) => v.id !== dialog.id),
                        },
                        "Saved view removed",
                        setError,
                      )
                    ) {
                      setActive("");
                      setDialog(null);
                    }
                  }}
                >
                  <Trash2 size={15} />
                  {remove ? "Confirm delete" : "Delete view"}
                </Button>
              )}
              <Button
                type="button"
                disabled={busy}
                onClick={() => setDialog(null)}
              >
                Cancel
              </Button>
              <Button variant="primary" disabled={busy || !name.trim()}>
                <Bookmark size={15} />
                {busy ? "Saving…" : dialog.id ? "Save changes" : "Save view"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

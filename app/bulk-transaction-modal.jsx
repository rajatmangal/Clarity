"use client";
import { useState } from "react";
import {
  ArrowRight,
  CheckCheck,
  Pencil,
  ShieldCheck,
  Split,
} from "lucide-react";
import { bulkEditPlan } from "../public/transaction-tools.js";
import { categoryLabel } from "../public/money-model.js";
import { needsReview } from "../public/core.js";

export default function BulkTransactionModal({
  state,
  ids,
  save,
  busy,
  onClose,
  Modal,
  Button,
  Field,
}) {
  const [category, setCategory] = useState("keep"),
    [account, setAccount] = useState("keep"),
    [review, setReview] = useState("keep"),
    [includeSplits, setIncludeSplits] = useState(false),
    [preview, setPreview] = useState(false),
    [error, setError] = useState(""),
    [limit, setLimit] = useState(20);
  const selectedIds = new Set(ids);
  const selected = state.transactions.filter((t) => selectedIds.has(t.id));
  const splitCount = new Set(
    (state.transactionSplits || [])
      .filter((s) => selectedIds.has(s.transaction))
      .map((s) => s.transaction),
  ).size;
  const eligible = selected.filter((t) =>
    ["expense", "refund"].includes(t.kind),
  ).length;
  const shared = (values) =>
    new Set(values).size > 1 ? "Mixed values" : values[0] || "None";
  const patch = {
    category: category === "keep" ? null : category.slice(4),
    account: account === "keep" ? null : account.slice(4),
    review,
    includeSplits,
  };
  let plan = null,
    planError = "";
  try {
    plan = bulkEditPlan(state, ids, patch);
  } catch (e) {
    planError = e.message;
  }
  const format = (n) =>
    new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: state.currency,
    }).format(n / 100);
  function edit() {
    setPreview(false);
    setError("");
  }
  return (
    <Modal
      wide
      title={preview ? "Review your changes" : "Edit selected transactions"}
      subtitle={`${ids.length} selected · Amounts, dates, and original descriptions stay intact.`}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="form-body bulk-body">
        <div className="bulk-steps" aria-label="Editing steps">
          <span className={!preview ? "active" : ""}>1 · Choose changes</span>
          <ArrowRight size={14} />
          <span className={preview ? "active" : ""}>2 · Review & save</span>
        </div>
        {error && (
          <p className="notice danger" role="alert">
            {error}
          </p>
        )}
        {!preview ? (
          <>
            <p className="bulk-intro">
              Choose only the fields you want to change. Everything else stays
              as it is.
            </p>
            <div className="bulk-fields">
              <Field
                label="Category"
                hint={
                  eligible
                    ? `Current: ${shared(selected.filter((t) => ["expense", "refund"].includes(t.kind)).map((t) => ((state.transactionSplits || []).some((s) => s.transaction === t.id) ? "Split categories" : categoryLabel(state.categories, t.category))))}`
                    : "Income and transfers do not use categories."
                }
              >
                <select
                  aria-label="Category"
                  disabled={busy || !eligible}
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    setError("");
                  }}
                >
                  <option value="keep">Leave categories unchanged</option>
                  {state.categories.map((c) => (
                    <option key={c.id} value={"set:" + c.id}>
                      {categoryLabel(state.categories, c.id)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Account"
                hint={`Current: ${shared(selected.map((t) => state.accounts.find((a) => a.id === t.account)?.name || "No account"))}`}
              >
                <select
                  aria-label="Account"
                  disabled={busy}
                  value={account}
                  onChange={(e) => {
                    setAccount(e.target.value);
                    setError("");
                  }}
                >
                  <option value="keep">Leave accounts unchanged</option>
                  <option value="set:">
                    No account · income, refunds & transfers only
                  </option>
                  {state.accounts.map((a) => (
                    <option key={a.id} value={"set:" + a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Review status"
                hint={`Current: ${shared(selected.map((t) => (needsReview(t, state) ? "Needs review" : "Reviewed")))}`}
              >
                <select
                  aria-label="Review status"
                  disabled={busy}
                  value={review}
                  onChange={(e) => {
                    setReview(e.target.value);
                    setError("");
                  }}
                >
                  <option value="keep">Leave review status unchanged</option>
                  <option value="reviewed">Mark as reviewed</option>
                  <option value="needs-review">Mark as needs review</option>
                </select>
              </Field>
            </div>
            {splitCount > 0 && (
              <div className="bulk-split-notice">
                <Split size={18} />
                <div>
                  <strong>
                    {splitCount} selected transaction
                    {splitCount === 1 ? " has" : "s have"} split allocations
                  </strong>
                  <p>
                    Split categories stay unchanged by default. Amounts, notes,
                    and allocation IDs are always preserved.
                  </p>
                  {category !== "keep" && (
                    <label className="check-row">
                      <input
                        type="checkbox"
                        disabled={busy}
                        checked={includeSplits}
                        onChange={(e) => {
                          setIncludeSplits(e.target.checked);
                          setError("");
                        }}
                      />
                      Also change every selected split allocation to{" "}
                      {categoryLabel(state.categories, patch.category)}
                    </label>
                  )}
                </div>
              </div>
            )}
            {planError &&
              (category !== "keep" ||
                account !== "keep" ||
                review !== "keep") && (
                <p className="notice danger" role="alert">
                  {planError}
                </p>
              )}
            {plan && !plan.changes.length && (
              <p className="notice">
                These transactions already match your choices. Nothing to
                update.
              </p>
            )}
            <p className="form-note">
              <ShieldCheck size={14} /> Only selected transactions are edited.
              Saved merchant rules stay unchanged. An automatic backup is kept
              before saving.
            </p>
          </>
        ) : plan ? (
          <>
            <div className="bulk-summary">
              <div>
                <strong>{plan.changes.length}</strong>
                <span>transactions changing</span>
              </div>
              <div>
                <strong>{plan.unchanged}</strong>
                <span>already match or kept</span>
              </div>
              <div>
                <strong>{plan.allocationChanges}</strong>
                <span>allocation categories changing</span>
              </div>
            </div>
            {plan.skippedCategories > 0 && (
              <p className="notice">
                Category changes skip {plan.skippedCategories} selected
                transaction{plan.skippedCategories === 1 ? "" : "s"}:
                income/transfers and split purchases unless explicitly included.
                Other chosen fields still apply.
              </p>
            )}
            <div className="bulk-preview-list">
              {plan.changes.slice(0, limit).map((change) => (
                <article className="bulk-preview-row" key={change.id}>
                  <div className="bulk-preview-title">
                    <strong>{change.merchant}</strong>
                    <span>
                      {change.date} · {change.kind} · {format(change.amount)}
                    </span>
                  </div>
                  <dl>
                    {change.fields.map((field) => (
                      <div key={field.name}>
                        <dt>{field.name}</dt>
                        <dd>
                          <span>{field.before}</span>
                          <ArrowRight size={13} aria-label="changes to" />
                          <strong>{field.after}</strong>
                        </dd>
                      </div>
                    ))}
                  </dl>
                </article>
              ))}
            </div>
            {plan.changes.length > limit && (
              <Button disabled={busy} onClick={() => setLimit(limit + 20)}>
                Show next {Math.min(20, plan.changes.length - limit)} changes
              </Button>
            )}
            <p className="form-note">
              Saving applies these changes together. Your totals do not change;
              category spending and account reports may change.
            </p>
          </>
        ) : (
          <p className="notice danger" role="alert">
            {planError}
          </p>
        )}
      </div>
      <div className="dialog-actions">
        <Button disabled={busy} onClick={preview ? edit : onClose}>
          {preview ? "Back" : "Cancel"}
        </Button>
        {preview ? (
          <Button
            variant="primary"
            disabled={busy || !plan?.changes.length}
            onClick={async () => {
              setError("");
              if (
                await save(
                  plan.next,
                  `${plan.changes.length} transactions updated`,
                  setError,
                )
              )
                onClose();
            }}
          >
            <CheckCheck size={16} />
            {busy ? "Saving…" : `Save ${plan?.changes.length || 0} changes`}
          </Button>
        ) : (
          <Button
            variant="primary"
            disabled={busy || !plan?.changes.length}
            onClick={() => {
              setPreview(true);
              setLimit(20);
            }}
          >
            <Pencil size={15} />
            Preview changes
          </Button>
        )}
      </div>
    </Modal>
  );
}

"use client";
import { useMemo, useState } from "react";
import {
  FileSpreadsheet,
  Undo2,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import {
  accountCoverage,
  confirmCoverage,
  coverageStatus,
  undoImport,
  undoPreview,
} from "../public/statement-history.js";

const labels = {
  complete: "Complete",
  confirmed: "Confirmed complete",
  partial: "Partial",
  missing: "Missing",
  "needs-review": "Needs review",
  "no-activity": "No activity confirmed",
  undone: "Undone",
};
const title = (status) => labels[status] || status;

export function CoverageNotice({ state, start, end, onOpen }) {
  const statuses = useMemo(
    () =>
      new Map(
        (state.statementCoverage || []).map((c) => [
          c.id,
          coverageStatus(state, c),
        ]),
      ),
    [state],
  );
  const incomplete = state.accounts.filter(
    (a) => accountCoverage(state, a.id, start, end, statuses) !== "complete",
  );
  if (!incomplete.length) return null;
  return (
    <div className="notice coverage-notice">
      <AlertCircle size={18} />
      <span>
        <strong>Spending may be incomplete.</strong> {incomplete.length} of{" "}
        {state.accounts.length} accounts lack confirmed coverage for {start} to{" "}
        {end}. Totals reflect recorded transactions only.
      </span>
      <button className="btn" onClick={onOpen}>
        Review statements
      </button>
    </div>
  );
}

export default function StatementsPage({
  state,
  start,
  end,
  save,
  busy,
  demo,
  Modal,
  Button,
  Field,
}) {
  const [account, setAccount] = useState("");
  const [editor, setEditor] = useState(null);
  const [undoId, setUndoId] = useState(null);
  const [removeEdited, setRemoveEdited] = useState(false);
  const [error, setError] = useState("");
  const [allHistory, setAllHistory] = useState(false);
  const statuses = useMemo(
    () =>
      new Map(
        (state.statementCoverage || []).map((c) => [
          c.id,
          coverageStatus(state, c),
        ]),
      ),
    [state],
  );
  const coverageYear = start.slice(0, 4);
  const accounts = state.accounts.filter((a) => !account || a.id === account);
  const batches = [...(state.importBatches || [])]
    .filter(
      (b) =>
        (!account || b.account === account) &&
        (allHistory || (b.start <= end && b.end >= start)),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const periods = (state.statementCoverage || []).filter(
    (c) =>
      (!account || c.account === account) &&
      c.start <= end &&
      c.end >= start &&
      statuses.get(c.id) !== "undone",
  );
  const batch = (state.importBatches || []).find((b) => b.id === undoId);
  const preview =
    batch?.status === "active" ? undoPreview(state, undoId) : null;
  const disabled = busy || !!demo;
  function edit(record) {
    setError("");
    setEditor(record);
  }
  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      const next = confirmCoverage(state, editor);
      if (await save(next, "Statement coverage saved", setError))
        setEditor(null);
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <div className="statements-page">
      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>Account coverage</h2>
            <p>
              {start} to {end}. Confirm the dates on your statement, not just
              the dates of purchases.
            </p>
          </div>
          <FileSpreadsheet size={22} />
        </div>
        <div className="statement-toolbar">
          <Field label="Filter account">
            <select
              value={account}
              onChange={(e) => setAccount(e.target.value)}
            >
              <option value="">All accounts</option>
              {state.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          <Button
            disabled={disabled || !state.accounts.length}
            onClick={() =>
              edit({
                id: crypto.randomUUID(),
                account: account || state.accounts[0].id,
                start,
                end,
                status: "confirmed",
                note: "",
              })
            }
          >
            Confirm a period
          </Button>
        </div>
        {!accounts.length && (
          <p className="notice">
            Add an account and import a statement to start tracking coverage.
          </p>
        )}
        <div className="coverage-cards">
          {accounts.map((a) => {
            const status = accountCoverage(state, a.id, start, end, statuses);
            const latest = (state.importBatches || [])
              .filter((b) => b.account === a.id && b.status === "active")
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
            return (
              <article key={a.id} className="coverage-card">
                <div>
                  <strong>{a.name}</strong>
                  <span className={`coverage-badge ${status}`}>
                    {status === "complete" && <CheckCircle2 size={13} />}
                    {title(status)}
                  </span>
                </div>
                <p>
                  {latest
                    ? `Last active import: ${new Date(latest.createdAt).toLocaleDateString()}`
                    : "No active imports recorded"}
                </p>
                <Button
                  disabled={disabled}
                  onClick={() =>
                    edit({
                      id: crypto.randomUUID(),
                      account: a.id,
                      start,
                      end,
                      status: "confirmed",
                      note: "",
                    })
                  }
                >
                  Confirm coverage
                </Button>
              </article>
            );
          })}
        </div>
        <p className="form-note">
          Complete means confirmed periods cover every day in this view. Partial
          includes gaps, skipped rows, or changed records. No imports before
          this feature have been reconstructed; confirm those periods manually.
          Balance snapshots alone do not prove coverage.
        </p>
      </section>

      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>{coverageYear} at a glance</h2>
            <p>
              Each month needs confirmed coverage for every day. Choose a month
              to record or update your confirmation. Change the year with the
              date controls above.
            </p>
          </div>
        </div>
        {!accounts.length && (
          <p className="notice">Your accounts will appear here.</p>
        )}
        {accounts.map((a) => (
          <div className="coverage-calendar" key={a.id}>
            <h3>{a.name}</h3>
            <div className="coverage-months">
              {Array.from({ length: 12 }, (_, i) => {
                const month = `${coverageYear}-${String(i + 1).padStart(2, "0")}`;
                const first = month + "-01";
                const d = new Date(first + "T12:00:00Z");
                d.setUTCMonth(d.getUTCMonth() + 1, 0);
                const final = d.toISOString().slice(0, 10);
                const status = accountCoverage(
                  state,
                  a.id,
                  first,
                  final,
                  statuses,
                );
                return (
                  <button
                    key={month}
                    className={`coverage-month ${status}`}
                    disabled={disabled}
                    aria-label={`${a.name}, ${month}: ${title(status)}. Confirm coverage`}
                    onClick={() =>
                      edit({
                        id: crypto.randomUUID(),
                        account: a.id,
                        start: first,
                        end: final,
                        status: "confirmed",
                        note: "",
                      })
                    }
                  >
                    <strong>
                      {new Date(first + "T12:00:00Z").toLocaleDateString(
                        "en-CA",
                        { month: "short", timeZone: "UTC" },
                      )}
                    </strong>
                    <span>{title(status)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>Coverage periods</h2>
            <p>
              Overlapping confirmed periods are combined. Changes to dates,
              amounts, types, or records require a fresh confirmation.
            </p>
          </div>
        </div>
        {!periods.length && (
          <p className="notice">
            No coverage periods recorded in this date range.
          </p>
        )}
        <div className="statement-list">
          {periods.map((c) => (
            <article className="statement-row" key={c.id}>
              <div className="statement-info">
                <strong>
                  {state.accounts.find((a) => a.id === c.account)?.name ||
                    "Deleted account"}
                </strong>
                <p>
                  {c.start} → {c.end}
                </p>
                <span className={`coverage-badge ${statuses.get(c.id)}`}>
                  {title(statuses.get(c.id))}
                </span>
                <p>
                  {c.batch
                    ? "From an import. Confirming again creates a separate manual record."
                    : "Manually confirmed"}
                  {c.note && ` · ${c.note}`}
                </p>
              </div>
              <div className="statement-actions">
                <Button
                  aria-label="Edit coverage"
                  disabled={disabled}
                  onClick={() =>
                    edit({
                      ...c,
                      id: c.batch ? crypto.randomUUID() : c.id,
                      batch: "",
                    })
                  }
                >
                  <Pencil size={16} />
                </Button>
                <Button
                  aria-label="Remove coverage period"
                  disabled={disabled}
                  onClick={async () => {
                    await save(
                      {
                        ...state,
                        statementCoverage: state.statementCoverage.filter(
                          (p) => p.id !== c.id,
                        ),
                      },
                      "Coverage period removed; transactions unchanged",
                    );
                  }}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>Import history</h2>
            <p>
              Stored locally. Undo affects transactions created by the selected
              batch only.
            </p>
          </div>
        </div>
        <label className="check-label">
          <input
            type="checkbox"
            checked={allHistory}
            onChange={(e) => setAllHistory(e.target.checked)}
          />
          Show imports from all dates
        </label>
        {!batches.length && (
          <p className="notice">
            No recorded imports
            {allHistory ? "" : " overlapping this date range"}. Your next
            statement import will appear here.
          </p>
        )}
        <div className="statement-list">
          {batches.map((b) => (
            <article className="statement-row" key={b.id}>
              <div className="statement-info">
                <strong>{b.filename}</strong>
                <p>
                  {state.accounts.find((a) => a.id === b.account)?.name ||
                    `${b.accountName} (deleted account)`}{" "}
                  · {b.start} → {b.end}
                </p>
                <p>Imported {new Date(b.createdAt).toLocaleString()}</p>
                <div className="statement-counts">
                  <span>{b.imported} added</span>
                  <span>{b.duplicates} duplicates skipped</span>
                  <span>{b.skipped} excluded</span>
                  <span>{b.invalid} invalid</span>
                </div>
                {b.status === "undone" && (
                  <p className="coverage-badge undone">
                    Undone {new Date(b.undoneAt).toLocaleString()}
                  </p>
                )}
                {b.warnings && (
                  <details>
                    <summary>Import warnings</summary>
                    <p className="statement-warnings">{b.warnings}</p>
                    {b.invalid > 30 && (
                      <p>
                        First 30 errors shown; {b.invalid} rows were invalid.
                      </p>
                    )}
                  </details>
                )}
                <details>
                  <summary>File fingerprint</summary>
                  <p className="statement-hash">
                    SHA-256 of decoded CSV text: {b.hash}
                  </p>
                  <p>The original CSV is not retained.</p>
                </details>
              </div>
              <div className="statement-actions">
                <Button
                  disabled={disabled || b.status !== "active"}
                  onClick={() => {
                    setUndoId(b.id);
                    setRemoveEdited(false);
                    setError("");
                  }}
                >
                  <Undo2 size={16} />
                  Undo import
                </Button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {editor && (
        <Modal
          title="Confirm statement coverage"
          subtitle="This records your confirmation. It does not add transactions or verify a bank balance."
          onClose={() => setEditor(null)}
        >
          <form onSubmit={submit}>
            <div className="form-body">
              <Field label="Account">
                <select
                  required
                  value={editor.account}
                  onChange={(e) =>
                    setEditor({ ...editor, account: e.target.value })
                  }
                >
                  {state.accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="form-grid">
                <Field label="Start date">
                  <input
                    type="date"
                    required
                    value={editor.start}
                    onChange={(e) =>
                      setEditor({ ...editor, start: e.target.value })
                    }
                  />
                </Field>
                <Field label="End date">
                  <input
                    type="date"
                    required
                    value={editor.end}
                    onChange={(e) =>
                      setEditor({ ...editor, end: e.target.value })
                    }
                  />
                </Field>
              </div>
              <Field label="Coverage">
                <select
                  value={editor.status}
                  onChange={(e) =>
                    setEditor({ ...editor, status: e.target.value })
                  }
                >
                  <option value="confirmed">Confirmed complete</option>
                  <option value="partial">Partial / missing records</option>
                  <option value="no-activity">Confirmed no activity</option>
                </select>
              </Field>
              <Field label="Note (optional)">
                <input
                  maxLength={500}
                  value={editor.note}
                  onChange={(e) =>
                    setEditor({ ...editor, note: e.target.value })
                  }
                  placeholder="For example: checked against September statement"
                />
              </Field>
              <p className="notice">
                Confirm complete only after checking that this account's records
                cover the whole period. No activity requires an empty period you
                have checked.
              </p>
              {error && (
                <p role="alert" className="notice danger">
                  {error}
                </p>
              )}
            </div>
            <div className="dialog-actions">
              <Button type="button" onClick={() => setEditor(null)}>
                Cancel
              </Button>
              <Button variant="primary" disabled={disabled}>
                Save coverage
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {batch && preview && (
        <Modal
          title="Undo this import?"
          subtitle={batch.filename}
          onClose={() => setUndoId(null)}
        >
          <div className="form-body">
            <p>
              <strong>{preview.unchanged.length}</strong> unchanged transactions
              will be removed.
            </p>
            <p>
              <strong>{preview.edited.length}</strong> transactions were edited
              after import and will be kept by default.
            </p>
            <p>
              <strong>{preview.missing.length}</strong> transactions are already
              deleted.
            </p>
            {!!preview.edited.length && (
              <>
                <details>
                  <summary>Review edited transactions</summary>
                  {preview.edited.map((t) => (
                    <p key={t.id}>
                      {t.date} · {t.merchant || t.description} ·{" "}
                      {new Intl.NumberFormat("en-CA", {
                        style: "currency",
                        currency: state.currency,
                      }).format(t.amount / 100)}
                    </p>
                  ))}
                </details>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={removeEdited}
                    onChange={(e) => setRemoveEdited(e.target.checked)}
                  />
                  Also delete these edited transactions. Their later changes
                  will be lost.
                </label>
              </>
            )}
            <p className="notice danger">
              This removes{" "}
              {preview.unchanged.length +
                (removeEdited ? preview.edited.length : 0)}{" "}
              transactions. Import history stays visible, and its coverage stops
              counting. Other affected coverage confirmations may need review.
              This cannot be redone here; you can import the CSV again.
            </p>
            <p className="form-note">
              Accounts, balance snapshots, saved mappings, and learned merchant
              categories are kept. Transactions that existed before this import
              are untouched.
            </p>
            {error && (
              <p role="alert" className="notice danger">
                {error}
              </p>
            )}
          </div>
          <div className="dialog-actions">
            <Button onClick={() => setUndoId(null)}>Cancel</Button>
            <Button
              variant="danger"
              disabled={disabled}
              onClick={async () => {
                try {
                  if (
                    await save(
                      undoImport(state, batch.id, { removeEdited }),
                      "Import undone",
                      setError,
                    )
                  )
                    setUndoId(null);
                } catch (e) {
                  setError(e.message);
                }
              }}
            >
              Undo import
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

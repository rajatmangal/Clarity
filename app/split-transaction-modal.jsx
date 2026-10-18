"use client";
import { useState } from "react";
import SplitEditor from "./split-editor";
import {
  splitsFor,
  draftSplits,
  setTransactionSplits,
  splitBalance,
} from "../public/transaction-splits.js";

export default function SplitTransactionModal({
  transaction,
  state,
  save,
  busy,
  onClose,
  Modal,
  Button,
  Field,
}) {
  const t = state.transactions.find((r) => r.id === transaction.id);
  const [mode, setMode] = useState("amount");
  const [error, setError] = useState("");
  const [rows, setRows] = useState(() => {
    const existing = splitsFor(state, transaction.id);
    return existing.length
      ? existing.map((s) => ({ ...s, value: (s.amount / 100).toFixed(2) }))
      : [
          {
            id: crypto.randomUUID(),
            category:
              transaction.category === "uncategorized"
                ? ""
                : transaction.category,
            value: (transaction.amount / 100).toFixed(2),
            note: "",
          },
          { id: crypto.randomUUID(), category: "", value: "", note: "" },
        ];
  });
  const over = splitBalance(t?.amount || 0, rows, mode).over;
  return (
    <Modal
      title="Split transaction"
      subtitle="Divide the categories while keeping the original transaction intact."
      onClose={onClose}
    >
      <form
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            if (!t || !["expense", "refund"].includes(t.kind))
              throw Error(
                "This purchase or refund is no longer available. Close and refresh your transactions.",
              );
            const allocations = draftSplits(
              t.amount,
              rows,
              mode,
              state.categories,
            );
            const next = setTransactionSplits(
              {
                ...state,
                transactions: state.transactions.map((r) =>
                  r.id === t.id
                    ? { ...r, category: "", source: "reviewed", review: false }
                    : r,
                ),
              },
              t.id,
              allocations,
            );
            if (await save(next, "Transaction split saved", setError))
              onClose();
          } catch (e) {
            setError(e.message);
          }
        }}
      >
        <div className="form-body">
          <p className="notice">
            <strong>{transaction.merchant || transaction.description}</strong> ·{" "}
            {transaction.date} · {transaction.kind}
          </p>
          {error && (
            <p className="notice danger" role="alert">
              {error}
            </p>
          )}
          <SplitEditor
            rows={rows}
            setRows={(next) => {
              setRows(next);
              setError("");
            }}
            mode={mode}
            setMode={(next) => {
              setMode(next);
              setError("");
            }}
            total={t?.amount || transaction.amount}
            currency={state.currency}
            categories={state.categories}
            Button={Button}
            Field={Field}
          />
        </div>
        <div className="dialog-actions">
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={busy || over || !t}>
            Save split
          </Button>
        </div>
      </form>
    </Modal>
  );
}

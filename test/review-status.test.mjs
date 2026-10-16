import test from "node:test";
import assert from "node:assert/strict";
import { needsReview } from "../public/core.js";
test("manual and explicitly reviewed transactions never need another review", () => {
  for (const kind of ["expense", "refund", "income", "transfer"])
    for (const source of ["manual", "reviewed"])
      assert.equal(
        needsReview({ kind, source, category: "uncategorized", review: false }),
        false,
      );
});
test("unreviewed imports and AI suggestions retain their review status", () => {
  assert.equal(
    needsReview({
      kind: "expense",
      source: "csv",
      category: "uncategorized",
      review: false,
    }),
    true,
  );
  assert.equal(
    needsReview({
      kind: "expense",
      source: "ai",
      category: "groceries",
      review: true,
    }),
    true,
  );
  assert.equal(
    needsReview({
      kind: "transfer",
      source: "csv",
      category: "",
      review: true,
    }),
    true,
  );
  assert.equal(
    needsReview({
      kind: "expense",
      source: "learned",
      category: "groceries",
      review: false,
    }),
    false,
  );
});

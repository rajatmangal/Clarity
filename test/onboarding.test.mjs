import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  Store,
  emptyState,
  serialize,
  deserialize,
  validate,
} from "../lib/store.mjs";

test("setup remains unfinished until saved and survives reopening the vault", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "clarity-setup-"));
  try {
    const store = new Store(dir);
    await store.init();
    const first = await store.read();
    assert.equal(first.state.onboardingCompleted, false);
    const preferences = {
      ...first.state,
      displayName: "Sam",
      currency: "INR",
      theme: "graphite",
      onboardingCompleted: true,
    };
    await store.save(preferences, first.revision);
    const reopened = new Store(dir);
    await reopened.init();
    const saved = (await reopened.read()).state;
    assert.equal(saved.onboardingCompleted, true);
    assert.equal(saved.displayName, "Sam");
    assert.equal(saved.currency, "INR");
    assert.equal(saved.theme, "graphite");
    assert.match(
      await readFile(path.join(dir, "Settings.md"), "utf8"),
      /onboardingCompleted/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("existing four-column settings gain setup status without losing preferences or notes", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "clarity-setup-upgrade-"));
  try {
    const store = new Store(dir);
    await store.init();
    const initial = await store.read();
    await store.save(
      { ...initial.state, displayName: "Existing name", theme: "sage" },
      initial.revision,
    );
    const file = path.join(dir, "Settings.md");
    let text = await readFile(file, "utf8");
    text = text
      .split("\n")
      .map((line) =>
        line.startsWith("|")
          ? line.slice(0, line.lastIndexOf("|", line.length - 2) + 1)
          : line,
      )
      .join("\n");
    await writeFile(file, text + "\nKeep my personal note.\n");
    const reopened = new Store(dir);
    await reopened.init();
    const saved = (await reopened.read()).state;
    assert.equal(saved.onboardingCompleted, false);
    assert.equal(saved.displayName, "Existing name");
    assert.equal(saved.theme, "sage");
    assert.match(await readFile(file, "utf8"), /Keep my personal note/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("setup status uses booleans and invalid values cannot silently complete setup", () => {
  const state = emptyState();
  assert.equal(deserialize(serialize(state)).onboardingCompleted, false);
  assert.throws(
    () => validate({ ...state, onboardingCompleted: "false" }),
    /setup status/,
  );
  assert.throws(
    () => deserialize(serialize({ ...state, onboardingCompleted: "done" })),
    /onboardingCompleted/,
  );
});

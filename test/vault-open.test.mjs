import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  readdir,
  rm,
  symlink,
  unlink,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Store, serialize } from "../lib/store.mjs";
import { VaultOpener, inspectExistingVault } from "../lib/vault-open.mjs";
import { lockVault } from "../lib/vault-lock.mjs";
import { readLocalSettings } from "../lib/local-settings.mjs";

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "clarity-reinstall-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new Store(path.join(root, "fresh-app-vault"));
  await store.init();
  const existing = new Store(path.join(root, "previous-vault"));
  await existing.init();
  let current = await existing.read();
  const saved = await existing.save(
    {
      ...current.state,
      displayName: "Returning user",
      currency: "USD",
      theme: "midnight",
      onboardingCompleted: true,
      accounts: [{ id: "a", name: "Previous savings", type: "savings" }],
      transactions: [
        {
          id: "t",
          date: "2026-10-18",
          amount: 2500,
          kind: "expense",
          category: "groceries",
          account: "a",
          merchant: "Previous purchase",
          description: "Saved description",
          source: "reviewed",
          review: false,
          location: "",
          reference: "",
        },
      ],
      savedViews: [
        {
          id: "view",
          name: "Saved groceries",
          search: "",
          type: "all",
          category: "groceries",
          account: "all",
          dateMode: "month",
          start: "",
          end: "",
        },
      ],
    },
    current.revision,
  );
  await writeFile(path.join(existing.dir, "Notes.md"), "Personal notes");
  return { root, store, existing, saved, opener: new VaultOpener(store, root) };
}

test("reinstall can open the same vault without replacing its records or preferences", async (t) => {
  const { root, store, existing, saved, opener } = await fixture(t),
    source = store.dir;
  const raw = await readFile(
    path.join(existing.dir, "Transactions.md"),
    "utf8",
  );
  const preview = await opener.preview(existing.dir);
  assert.equal(preview.transactions, 1);
  assert.equal(preview.currency, "USD");
  assert.equal(preview.theme, "midnight");
  assert.equal(preview.savedViews, 1);
  assert.equal((await store.read()).state.transactions.length, 0);
  const result = await opener.open(preview.token);
  t.after(() => result.release?.());
  assert.deepEqual(result.state, saved.state);
  assert.equal(
    await readFile(path.join(existing.dir, "Transactions.md"), "utf8"),
    raw,
  );
  assert.equal(
    await readFile(path.join(existing.dir, "Notes.md"), "utf8"),
    "Personal notes",
  );
  assert.equal((await new Store(source).read()).state.transactions.length, 0);
  assert.equal((await readLocalSettings(root)).VAULT_DIR, result.vaultPath);
  result.release();
  // Simulate another install that only knows the saved path.
  const restarted = new Store((await readLocalSettings(root)).VAULT_DIR);
  await restarted.init();
  assert.deepEqual((await restarted.read()).state, saved.state);
});

test("opening unrelated, empty, incomplete or symlink folders never creates a new ledger there", async (t) => {
  const { root, opener, existing } = await fixture(t);
  const empty = path.join(root, "empty");
  await mkdir(empty);
  await assert.rejects(opener.preview(empty), /not a Clarity vault/);
  assert.deepEqual(await readdir(empty), []);
  await writeFile(path.join(empty, "Note.md"), "Keep");
  await assert.rejects(opener.preview(empty), /not a Clarity vault/);
  assert.equal((await readdir(empty)).length, 1);
  await symlink(existing.dir, path.join(root, "alias"));
  await assert.rejects(
    opener.preview(path.join(root, "alias")),
    /symbolic link/,
  );
  await unlink(path.join(existing.dir, "Transactions.md"));
  await assert.rejects(
    opener.preview(existing.dir),
    /Transactions.md is missing/,
  );
  await assert.rejects(readFile(path.join(root, ".env")), { code: "ENOENT" });
});

test("an active vault or stale preview cannot be opened over another instance", async (t) => {
  const { root, opener, existing, saved } = await fixture(t);
  let preview = await opener.preview(existing.dir);
  const release = await lockVault(existing);
  try {
    await assert.rejects(opener.open(preview.token), /already open/);
  } finally {
    release();
  }
  await assert.rejects(readFile(path.join(root, ".env")), { code: "ENOENT" });
  preview = await opener.preview(existing.dir);
  await writeFile(path.join(existing.dir, "Money.md"), "# External change");
  await assert.rejects(opener.open(preview.token), /changed/);
  await assert.rejects(readFile(path.join(existing.dir, ".clarity.lock")), {
    code: "ENOENT",
  });
  assert.deepEqual((await existing.read()).state, saved.state);
});

test("configuration failure preserves both vaults and releases the destination lock", async (t) => {
  const { root, store, opener, existing, saved } = await fixture(t);
  await mkdir(path.join(root, ".env"));
  const preview = await opener.preview(existing.dir);
  await assert.rejects(opener.open(preview.token));
  assert.equal((await store.read()).state.transactions.length, 0);
  assert.deepEqual((await existing.read()).state, saved.state);
  await assert.rejects(readFile(path.join(existing.dir, ".clarity.lock")), {
    code: "ENOENT",
  });
});

test("legacy vaults are recognized without writes during preview, then migrate with a backup", async (t) => {
  const { root, opener, saved } = await fixture(t),
    legacy = path.join(root, "legacy");
  await mkdir(legacy);
  const raw = serialize(saved.state, "\n## Notes\n\nOriginal legacy notes");
  await writeFile(path.join(legacy, "Money.md"), raw);
  const preview = await opener.preview(legacy);
  assert.equal(preview.olderFormat, true);
  assert.deepEqual(await readdir(legacy), ["Money.md"]);
  const result = await opener.open(preview.token);
  t.after(() => result.release?.());
  assert.deepEqual(result.state, saved.state);
  assert.match(
    await readFile(path.join(legacy, "Money.md"), "utf8"),
    /Original legacy notes/,
  );
  assert.ok(
    (await readdir(path.join(legacy, ".backups"))).some((name) =>
      name.startsWith("legacy-"),
    ),
  );
});

test("opening the current folder reuses its lock and requires a valid preview", async (t) => {
  const { store, opener } = await fixture(t);
  const release = await lockVault(store);
  t.after(release);
  const preview = await opener.preview(store.dir);
  const result = await opener.open(preview.token);
  assert.equal(result.release, null);
  assert.ok(await readFile(path.join(store.dir, ".clarity.lock"), "utf8"));
  await assert.rejects(opener.open(preview.token), /expired/);
  await assert.rejects(inspectExistingVault("relative/path"), /full path/);
});

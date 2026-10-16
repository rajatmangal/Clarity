import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  readFile,
  writeFile,
  stat,
  rm,
  mkdir,
  symlink,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Store } from "../lib/store.mjs";
import {
  writeEnv,
  readLocalSettings,
  moveVault,
} from "../lib/local-settings.mjs";
import {
  currencyCodes,
  favouriteCurrencies,
  currencyName,
} from "../public/currencies.js";
async function setup(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "folio-settings-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new Store(path.join(root, "vault"));
  await store.init();
  return { root, store };
}
test("local environment preserves other settings, safely round trips, and disconnects", async (t) => {
  const { root } = await setup(t);
  await writeFile(path.join(root, ".env"), "OTHER=yes\n");
  await writeEnv(root, {
    OPENAI_API_KEY: "test-only",
    VAULT_DIR: '/tmp/A $name "quoted"',
  });
  assert.equal(
    (await readLocalSettings(root)).VAULT_DIR,
    '/tmp/A $name "quoted"',
  );
  assert.equal((await readLocalSettings(root)).OTHER, "yes");
  assert.equal((await stat(path.join(root, ".env"))).mode & 0o777, 0o600);
  await writeEnv(root, { OPENAI_API_KEY: "" });
  assert.equal((await readLocalSettings(root)).OPENAI_API_KEY, "");
});
test("vault move retains ledger, notes, and backups and works again", async (t) => {
  const { root, store } = await setup(t);
  let before = await store.read();
  await store.save(before.state, before.revision);
  await writeFile(path.join(store.dir, "My notes.md"), "Personal note");
  before = await store.read();
  const original = store.dir;
  await moveVault(
    store,
    path.join(root, "new", "Money"),
    before.revision,
    root,
  );
  assert.deepEqual((await store.read()).state, before.state);
  assert.equal(
    await readFile(path.join(store.dir, "My notes.md"), "utf8"),
    "Personal note",
  );
  await stat(path.join(store.dir, ".backups"));
  await assert.rejects(stat(original), { code: "ENOENT" });
  assert.equal((await readLocalSettings(root)).VAULT_DIR, store.dir);
  await moveVault(
    store,
    path.join(root, "final"),
    (await store.read()).revision,
    root,
  );
  assert.deepEqual((await store.read()).state, before.state);
});
test("move rejects occupied folders, stale revisions, nested paths and symlink aliases", async (t) => {
  const { root, store } = await setup(t);
  const before = await store.read();
  await assert.rejects(moveVault(store, root, before.revision, root));
  await assert.rejects(moveVault(store, path.join(root, "new"), "stale", root));
  await assert.rejects(
    moveVault(store, path.join(store.dir, "nested"), before.revision, root),
  );
  await symlink(store.dir, path.join(root, "alias"));
  await assert.rejects(
    moveVault(store, path.join(root, "alias", "nested"), before.revision, root),
  );
  assert.deepEqual((await store.read()).state, before.state);
});
test("configuration write failure preserves original vault", async (t) => {
  const { root, store } = await setup(t);
  await mkdir(path.join(root, ".env"));
  const before = await store.read();
  await assert.rejects(
    moveVault(store, path.join(root, "new"), before.revision, root),
  );
  assert.deepEqual((await store.read()).state, before.state);
});
test("currency list includes all runtime currencies with favourites first", () => {
  assert.ok(currencyCodes.length > 150);
  assert.deepEqual(currencyCodes.slice(0, 3), favouriteCurrencies);
  assert.ok(currencyCodes.includes("JPY"));
  assert.ok(currencyName("INR").includes("Rupee"));
});

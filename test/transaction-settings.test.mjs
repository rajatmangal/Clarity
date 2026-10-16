import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { pickFolder } from "../lib/folder-picker.mjs";
import {
  Store,
  emptyState,
  serialize,
  deserialize,
  validate,
} from "../lib/store.mjs";
import { themes } from "../public/money-model.js";
test("folder picker uses native dialogs, preserves spaces, handles cancel and failure", async () => {
  for (const [platform, executable] of [
    ["darwin", "/usr/bin/osascript"],
    ["win32", "powershell.exe"],
    ["linux", "zenity"],
  ]) {
    assert.equal(
      await pickFolder(platform, async (cmd, args, opts) => {
        assert.equal(cmd, executable);
        assert.ok(args.length);
        assert.equal(opts.timeout, 120000);
        return { stdout: "/tmp/My Money\n" };
      }),
      "/tmp/My Money",
    );
  }
  assert.equal(
    await pickFolder("darwin", async () => {
      throw { stderr: "User canceled. (-128)" };
    }),
    null,
  );
  await assert.rejects(
    pickFolder("linux", async () => {
      throw { code: "ENOENT" };
    }),
    /paste a folder path/,
  );
});
test("profile and all eight themes round trip; previous settings headers remain readable", () => {
  const s = emptyState();
  s.displayName = "Rajat | नमस्ते";
  for (const theme of themes) {
    s.theme = theme.id;
    assert.equal(deserialize(serialize(s)).theme, theme.id);
    assert.equal(deserialize(serialize(s)).displayName, s.displayName);
  }
  const raw = serialize(emptyState());
  const legacy = raw.replace(
    /(## Settings\n)([\s\S]*?)(?=\n## )/,
    (_, heading, table) =>
      heading +
      table
        .split("\n")
        .map((l) =>
          l.startsWith("|")
            ? l.slice(0, l.lastIndexOf("|", l.length - 2) + 1)
            : l,
        )
        .join("\n"),
  );
  assert.equal(deserialize(legacy).displayName, "");
  assert.throws(() => validate({ ...s, displayName: "x".repeat(81) }));
});
test("editing and bulk removal persist, preserve unrelated records and back up deleted records", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "folio-edit-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new Store(root);
  await store.init();
  let old = await store.read();
  const tx = (id) => ({
    id,
    date: "2026-10-01",
    description: "Original",
    merchant: "Employer",
    reference: "",
    location: "",
    amount: 10000,
    kind: "income",
    account: "",
    category: "",
    review: false,
    source: "manual",
  });
  let saved = await store.save(
    { ...old.state, transactions: ["a", "b", "c"].map(tx) },
    old.revision,
  );
  saved = await store.save(
    {
      ...saved.state,
      transactions: saved.state.transactions.map((t) =>
        t.id === "a" ? { ...t, description: "Edited", amount: 12000 } : t,
      ),
    },
    saved.revision,
  );
  assert.equal(
    (await store.read()).state.transactions[0].description,
    "Edited",
  );
  await store.save(
    {
      ...saved.state,
      transactions: saved.state.transactions.filter(
        (t) => !["a", "b"].includes(t.id),
      ),
    },
    saved.revision,
  );
  assert.deepEqual(
    (await store.read()).state.transactions.map((t) => t.id),
    ["c"],
  );
  const backups = await readdir(path.join(root, ".backups"));
  assert.ok(
    (
      await Promise.all(
        backups.map((n) =>
          readFile(path.join(root, ".backups", n, "Transactions.md"), "utf8"),
        ),
      )
    ).some((s) => s.includes("Edited")),
  );
});

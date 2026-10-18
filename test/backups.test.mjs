import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  writeFile,
  readFile,
  readdir,
  mkdir,
  rm,
  symlink,
  realpath,
  rename,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { zipSync } from "fflate";
import { Store, serialize } from "../lib/store.mjs";
import { Backups, prepareBackup } from "../lib/backups.mjs";
import { importArchive, exportArchive } from "../lib/backup-archive.mjs";
import {
  collectVault,
  manifestFor,
  safeVaultName,
  limits,
} from "../lib/vault-files.mjs";
import { transactionCSV, csvCell } from "../lib/export-csv.mjs";
import { parseCSV } from "../public/core.js";

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "clarity-recovery-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new Store(path.join(root, "vault"));
  await store.init();
  const initial = await store.read();
  const saved = await store.save(
    {
      ...initial.state,
      onboardingCompleted: true,
      displayName: "Recovery test",
      accounts: [{ id: "bank", name: "Chequing", type: "bank" }],
      transactions: [
        {
          id: "purchase",
          date: "2026-10-16",
          amount: 2500,
          kind: "expense",
          category: "",
          merchant: '=HYPERLINK("bad")',
          description: 'First, line\nSecond "line"',
          account: "bank",
          source: "reviewed",
          review: false,
          location: "",
          reference: "",
        },
      ],
      transactionSplits: [
        {
          id: "food",
          transaction: "purchase",
          category: "groceries",
          amount: 1000,
          note: "Food",
        },
        {
          id: "home",
          transaction: "purchase",
          category: "shopping",
          amount: 1500,
          note: "Home",
        },
      ],
    },
    initial.revision,
  );
  return { root, store, backups: new Backups(store), saved };
}

test("named backup, ZIP round-trip, preview, restore, and undo preserve money, notes, binary files and preferences", async (t) => {
  const { store, backups, saved } = await fixture(t);
  await mkdir(path.join(store.dir, "Receipts"));
  const receipt = Buffer.from([0, 255, 1, 0, 254, 128]);
  await writeFile(path.join(store.dir, "Receipts", "receipt.png"), receipt);
  await writeFile(path.join(store.dir, "Notes.md"), "# My notes\n");
  await writeFile(path.join(store.dir, ".env"), "OPENAI_API_KEY=SECRET");
  await writeFile(path.join(store.dir, "ignore.js"), "SECRET");
  const named = await backups.create("Before changes");
  const zip = await backups.export();
  const unpacked = importArchive(zip.archive);
  assert.deepEqual(unpacked.files["Receipts/receipt.png"], receipt);
  assert.equal(unpacked.files[".env"], undefined);
  assert.equal(unpacked.files["ignore.js"], undefined);
  assert.ok(zip.skipped.includes("ignore.js (unsupported file)"));
  const source = prepareBackup(unpacked.files, unpacked.metadata);
  assert.deepEqual(source.state, saved.state);
  const changed = await store.save(
    {
      ...saved.state,
      displayName: "Changed",
      transactions: [],
      transactionSplits: [],
    },
    saved.revision,
  );
  await writeFile(path.join(store.dir, "Notes.md"), "# Changed note");
  await writeFile(path.join(store.dir, "Current only.md"), "Keep me");
  const preview = await backups.preview({ id: named.id });
  assert.equal(preview.changes.find((r) => r.name === "Transactions").added, 1);
  assert.equal(
    preview.changes.find((r) => r.name === "TransactionSplits").added,
    2,
  );
  assert.ok(preview.keptFiles.includes("Current only.md"));
  const restored = await backups.restore(preview.token);
  assert.deepEqual(restored.state, saved.state);
  assert.match(restored.safetyBackup, /^safety-/);
  assert.equal(
    await readFile(path.join(store.dir, "Notes.md"), "utf8"),
    "# My notes\n",
  );
  assert.equal(
    await readFile(path.join(store.dir, "Current only.md"), "utf8"),
    "Keep me",
  );
  assert.deepEqual(
    await readFile(path.join(store.dir, "Receipts/receipt.png")),
    receipt,
  );
  const undo = await backups.preview({ id: restored.safetyBackup });
  const original = await backups.restore(undo.token);
  assert.deepEqual(original.state, changed.state);
  assert.equal(
    await readFile(path.join(store.dir, "Notes.md"), "utf8"),
    "# Changed note",
  );
  await assert.rejects(backups.restore(preview.token), /expired/);
});

test("automatic snapshots record the previous save; 30-save rotation retains manual backups", async (t) => {
  const { store, backups } = await fixture(t);
  const manual = await backups.create("Permanent");
  for (let i = 0; i < 32; i++) {
    const current = await store.read();
    await store.save(
      { ...current.state, displayName: "Revision " + i },
      current.revision,
    );
  }
  const list = await backups.list();
  const auto = list.filter((b) => b.kind === "auto");
  assert.equal(auto.length, 30);
  assert.ok(list.find((b) => b.id === manual.id)?.valid);
  assert.ok(auto.every((b) => b.valid && b.scope === "data"));
  const latest = await backups.read(auto[0].id);
  assert.equal(latest.state.displayName, "Revision 30");
});

test("restore rejects stale preview, modified backup, symbolic links and incomplete snapshots", async (t) => {
  const { store, backups } = await fixture(t);
  const named = await backups.create();
  const preview = await backups.preview({ id: named.id });
  await writeFile(path.join(store.dir, "External.md"), "External edit");
  await assert.rejects(backups.restore(preview.token), /changed after preview/);
  await writeFile(
    path.join(store.dir, ".backups", named.id, "Transactions.md"),
    "Tampered",
  );
  await assert.rejects(backups.preview({ id: named.id }), /integrity/);
  assert.equal(
    (await backups.list()).find((b) => b.id === named.id).valid,
    false,
  );
  const incomplete = { ...(await collectVault(store.dir)).files };
  delete incomplete["Transactions.md"];
  assert.throws(() => prepareBackup(incomplete), /Transactions.md is missing/);
  await symlink(
    path.join(store.dir, "Accounts.md"),
    path.join(store.dir, "Link.md"),
  );
  assert.ok(
    (await backups.export()).skipped.some((s) => s.includes("symbolic link")),
  );
  await assert.rejects(store.atomic("Link.md", "No"), /Symbolic links/);
});

test("damaged ledger can be restored with a preserved raw safety copy; older ledgers normalize", async (t) => {
  const { store, backups, saved } = await fixture(t);
  const named = await backups.create();
  await writeFile(path.join(store.dir, "Transactions.md"), "# Damaged table");
  await assert.rejects(store.read());
  const preview = await backups.preview({ id: named.id });
  assert.ok(preview.currentError);
  assert.equal(preview.changes.length, 0);
  const result = await backups.restore(preview.token);
  assert.deepEqual(result.state, saved.state);
  assert.equal(
    await readFile(
      path.join(store.dir, ".backups", result.safetyBackup, "Transactions.md"),
      "utf8",
    ),
    "# Damaged table",
  );
  const legacy = prepareBackup({
    "Money.md": Buffer.from(serialize(saved.state)),
  });
  assert.deepEqual(legacy.state, saved.state);
});

test("interrupted restore recovers binary and financial files together; conflicts preserve pending data", async (t) => {
  const { store, saved } = await fixture(t);
  const old = await readFile(path.join(store.dir, "Money.md"), "utf8");
  const bytes = Buffer.from([255, 0, 7]);
  const journal = {
    next: {
      "Money.md": old + "\nRestored note",
      "Receipts/a.png": { encoding: "base64", data: bytes.toString("base64") },
    },
    old: { "Money.md": old, "Receipts/a.png": null },
  };
  await store.atomic(
    ".pending-save.md",
    "# Pending\n```json\n" + JSON.stringify(journal) + "\n```\n",
  );
  await store.atomic("Money.md", journal.next["Money.md"]); // interruption after first write
  const reopened = new Store(store.dir);
  await reopened.init();
  assert.deepEqual(
    await readFile(path.join(store.dir, "Receipts/a.png")),
    bytes,
  );
  assert.deepEqual((await reopened.read()).state, saved.state);
  await store.atomic(
    ".pending-save.md",
    "# Pending\n```json\n" + JSON.stringify(journal) + "\n```\n",
  );
  await writeFile(path.join(store.dir, "Money.md"), "External conflict");
  await assert.rejects(reopened.recover(), /conflicts with an external edit/);
  assert.equal(
    await readFile(path.join(store.dir, "Money.md"), "utf8"),
    "External conflict",
  );
  assert.ok(await readFile(path.join(store.dir, ".pending-save.md"), "utf8"));
});

test("ZIP restore into new folder leaves source intact and rejects occupied or nested destinations", async (t) => {
  const { root, store, backups, saved } = await fixture(t);
  const exported = await backups.export();
  const preview = await backups.preview({ archive: exported.archive });
  await assert.rejects(
    backups.restoreNew(preview.token, store.dir + "/nested"),
    /outside/,
  );
  await assert.rejects(backups.restoreNew(preview.token, root), /outside/);
  const occupied = path.join(root, "occupied");
  await mkdir(occupied);
  await writeFile(path.join(occupied, "note.md"), "Keep");
  await assert.rejects(
    backups.restoreNew(preview.token, occupied),
    /empty folder/,
  );
  const target = path.join(root, "restored");
  await mkdir(target);
  assert.equal(
    await backups.restoreNew(preview.token, target),
    await realpath(target),
  );
  assert.deepEqual((await new Store(target).read()).state, saved.state);
  assert.deepEqual((await store.read()).state, saved.state);
});

test("ZIP validation rejects traversal, duplicate filenames, oversized entries, links, encryption and tampered manifests", () => {
  const files = { "Notes.md": Buffer.from("Notes") };
  const rawZip = (entries, metadata = manifestFor(files)) =>
    Buffer.from(
      zipSync({
        ...entries,
        "clarity-backup.json": Buffer.from(JSON.stringify(metadata)),
      }),
    );
  assert.throws(
    () => importArchive(rawZip({ "../bad.md": Buffer.from("bad") })),
    /Unsafe/,
  );
  assert.throws(
    () =>
      importArchive(
        rawZip({
          "Notes.md": Buffer.from("Notes"),
          "notes.md": Buffer.from("Other"),
        }),
      ),
    /duplicate/,
  );
  assert.throws(
    () => importArchive(rawZip(files, { ...manifestFor(files), version: 999 })),
    /Unsupported/,
  );
  assert.throws(
    () => importArchive(rawZip({ "Notes.md": Buffer.from("Modified") })),
    /integrity/,
  );
  assert.throws(() => importArchive(Buffer.from("Not a zip")), /ZIP/);
  for (const type of ["oversized", "link", "encrypted"]) {
    const data = exportArchive(files),
      central = data.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    if (type === "oversized") data.writeUInt32LE(limits.file + 1, central + 24);
    if (type === "link") data.writeUInt32LE(0xa0000000, central + 38);
    if (type === "encrypted") data.writeUInt16LE(1, central + 8);
    assert.throws(() => importArchive(data), /size|links|Encrypted/);
  }
  for (const name of [
    "../a.md",
    "/a.md",
    "a\\b.md",
    "CON.md",
    ".env",
    "x/a.js",
    "a:ads.md",
  ])
    assert.equal(safeVaultName(name), false);
});

test("CSV exports splits without double counting, supports filters, and escapes unsafe spreadsheet text", async (t) => {
  const { saved } = await fixture(t);
  const rows = parseCSV(transactionCSV(saved.state));
  assert.equal(rows.length, 3);
  assert.equal(
    rows.slice(1).reduce((n, r) => n + Number(r[8]), 0),
    25,
  );
  assert.equal(
    rows.slice(1).reduce((n, r) => n + Number(r[9]), 0),
    25,
  );
  assert.deepEqual(
    rows.slice(1).map((r) => r[10]),
    ["25", ""],
  );
  assert.ok(rows[1][4].startsWith("'="));
  assert.equal(rows[1][5], 'First, line\nSecond "line"');
  assert.equal(parseCSV(transactionCSV(saved.state, { ids: [] })).length, 1);
  const filtered = parseCSV(
    transactionCSV(saved.state, { ids: ["purchase"], category: "groceries" }),
  );
  assert.equal(filtered.length, 2);
  assert.equal(Number(filtered[1][8]), 10);
  assert.equal(csvCell(-12.5), '"-12.5"');
  assert.equal(csvCell(" \t@formula"), '"\' \t@formula"');
});

test("failed restore resumes its journal before any subsequent read or save can expose mixed records", async (t) => {
  const { store, backups, saved } = await fixture(t);
  const backup = await backups.create();
  const current = await store.save(
    {
      ...saved.state,
      transactions: [],
      transactionSplits: [],
      displayName: "Changed",
    },
    saved.revision,
  );
  const preview = await backups.preview({ id: backup.id });
  const atomic = store.atomic.bind(store);
  let writes = 0;
  store.atomic = async (name, raw) => {
    if (name !== ".pending-save.md" && ++writes === 2)
      throw Error("Simulated interrupted restore");
    return atomic(name, raw);
  };
  await assert.rejects(
    backups.restore(preview.token),
    /Simulated interrupted restore/,
  );
  store.atomic = atomic;
  assert.ok(await readFile(path.join(store.dir, ".pending-save.md"), "utf8"));
  const recovered = await store.read();
  assert.deepEqual(recovered.state, saved.state);
  assert.ok((await backups.list()).some((b) => b.kind === "safety" && b.valid));
  await assert.rejects(readFile(path.join(store.dir, ".pending-save.md")), {
    code: "ENOENT",
  });
  assert.notEqual(current.revision, recovered.revision);
});

test("restore detects portable filename conflicts before writing a journal", async (t) => {
  const { root, store, backups } = await fixture(t);
  await writeFile(path.join(store.dir, "Notes.md"), "Original note");
  const named = await backups.create();
  await rename(
    path.join(store.dir, "Notes.md"),
    path.join(store.dir, "notes.md"),
  );
  const preview = await backups.preview({ id: named.id });
  assert.deepEqual(preview.pathConflicts, ["Notes.md"]);
  await assert.rejects(backups.restore(preview.token), /new folder instead/);
  await assert.rejects(readFile(path.join(store.dir, ".pending-save.md")), {
    code: "ENOENT",
  });
  assert.ok(
    await backups.restoreNew(preview.token, path.join(root, "new-vault")),
  );
  const files = (await collectVault(store.dir)).files;
  assert.throws(
    () =>
      prepareBackup({
        ...files,
        "notes.md/nested.md": Buffer.from("Conflicting path"),
      }),
    /conflicting file or folder/,
  );
  assert.throws(
    () => prepareBackup(files, { scope: "data" }),
    /unexpected notes/,
  );
});

import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  mkdtemp,
  rm,
  cp,
  mkdir,
  writeFile,
  readFile,
  unlink,
} from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import os from "node:os";
import { Store } from "../lib/store.mjs";
import { bulkEditPlan } from "../public/transaction-tools.js";
import { setTransactionSplits } from "../public/transaction-splits.js";
import {
  recordImport,
  undoImport,
  accountCoverage,
} from "../public/statement-history.js";
const port = await new Promise((resolve) => {
  const s = createServer();
  s.listen(0, "127.0.0.1", () => {
    const p = s.address().port;
    s.close(() => resolve(p));
  });
});
const root = await mkdtemp(path.join(os.tmpdir(), "clarity-http-"));
const runtime = path.join(root, "runtime");
await cp(process.env.CLARITY_TEST_RUNTIME || "build-runtime", runtime, {
  recursive: true,
});
const origin = `http://127.0.0.1:${port}`;
const startServer = () =>
  spawn(process.execPath, [path.join(runtime, "server.js")], {
    env: {
      ...process.env,
      NODE_ENV: "production",
      HOSTNAME: "127.0.0.1",
      PORT: String(port),
      CLARITY_CONFIG_DIR: root,
      VAULT_DIR: path.join(root, "vault"),
      OPENAI_API_KEY: "",
      CLARITY_PASSWORD: "integration-password",
      CLARITY_ORIGIN: origin,
      CLARITY_DESKTOP: "0",
      CLARITY_DESKTOP_SECRET: "",
    },
    stdio: "ignore",
  });
let child = startServer();
const auth =
  "Basic " + Buffer.from("clarity:integration-password").toString("base64");
test("packaged server protects data and accepts authorized read/write requests", async () => {
  try {
    let ready = false;
    for (let i = 0; i < 150; i++) {
      try {
        const r = await fetch(origin);
        if (r.status === 401) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(ready, true, "server started");
    assert.equal((await fetch(origin + "/api/state")).status, 401);
    await mkdir(path.join(root, "vault"), { recursive: true });
    const lock = path.join(root, "vault", ".clarity.lock");
    await writeFile(
      lock,
      JSON.stringify({ pid: process.pid, id: "other-instance" }),
    );
    const locked = await fetch(origin + "/api/state", {
      headers: { authorization: auth },
    });
    assert.equal(locked.status, 400);
    assert.match((await locked.json()).error, /already open/);
    await rm(lock);
    const initial = await fetch(origin + "/api/state", {
      headers: { authorization: auth },
    });
    assert.equal(initial.status, 200);
    const data = await initial.json();
    assert.equal(data.platform, "server");
    assert.equal(
      (
        await fetch(origin + "/api/updates", {
          headers: { authorization: auth },
        })
      ).status,
      404,
    );
    assert.equal(data.folderPickerAvailable, false);
    assert.equal(data.state.transactions.length, 0);
    const headers = {
      authorization: auth,
      "Content-Type": "application/json",
      "X-Clarity-Token": data.token,
      Origin: origin,
    };
    assert.equal(
      (
        await fetch(origin + "/api/updates", {
          method: "POST",
          headers,
          body: JSON.stringify({ action: "install" }),
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await fetch(origin + "/api/state", {
          method: "PUT",
          headers: { ...headers, Origin: "https://evil.example" },
          body: JSON.stringify({ state: data.state, revision: data.revision }),
        })
      ).status,
      403,
    );
    const saved = await fetch(origin + "/api/state", {
      method: "PUT",
      headers,
      body: JSON.stringify({
        state: { ...data.state, displayName: "Integration test" },
        revision: data.revision,
      }),
    });
    assert.equal(saved.status, 200);
    const persisted = await saved.json();
    assert.equal(persisted.state.displayName, "Integration test");
    const withAccount = {
      ...persisted.state,
      savedViews: [
        {
          id: "http-view",
          name: "Needs review this month",
          search: "",
          type: "review",
          category: "all",
          account: "all",
          dateMode: "month",
          start: "",
          end: "",
        },
      ],
      accounts: [
        { id: "statement-account", name: "Test chequing", type: "bank" },
      ],
    };
    const imported = recordImport(withAccount, {
      transactions: [
        {
          id: "statement-tx",
          account: "statement-account",
          date: "2026-09-10",
          description: "Synthetic purchase",
          merchant: "Synthetic purchase",
          location: "",
          reference: "",
          kind: "expense",
          category: "uncategorized",
          amount: 1250,
          review: false,
          source: "import",
        },
      ],
      complete: true,
      batch: {
        id: "statement-batch",
        account: "statement-account",
        accountName: "Test chequing",
        filename: "test.csv",
        hash: "b".repeat(64),
        createdAt: "2026-10-17T12:00:00Z",
        start: "2026-09-01",
        end: "2026-09-30",
        duplicates: 0,
        skipped: 0,
        invalid: 0,
        warnings: "",
      },
    });
    const importResponse = await fetch(origin + "/api/state", {
      method: "PUT",
      headers,
      body: JSON.stringify({ state: imported, revision: persisted.revision }),
    });
    assert.equal(importResponse.status, 200);
    const importResult = await importResponse.json();
    assert.equal(
      accountCoverage(
        importResult.state,
        "statement-account",
        "2026-09-01",
        "2026-09-30",
      ),
      "complete",
    );
    const corrupt = await fetch(origin + "/api/state", {
      method: "PUT",
      headers,
      body: JSON.stringify({
        state: { ...importResult.state, importEntries: [] },
        revision: importResult.revision,
      }),
    });
    assert.equal(corrupt.status, 400);
    const splitState = setTransactionSplits(
      {
        ...importResult.state,
        transactions: importResult.state.transactions.map((t) => ({
          ...t,
          category: "",
          source: "reviewed",
        })),
      },
      "statement-tx",
      [
        { id: "split-one", category: "groceries", amount: 500, note: "Food" },
        {
          id: "split-two",
          category: "shopping",
          amount: 750,
          note: "Household",
        },
      ],
    );
    const splitResponse = await fetch(origin + "/api/state", {
      method: "PUT",
      headers,
      body: JSON.stringify({
        state: splitState,
        revision: importResult.revision,
      }),
    });
    assert.equal(splitResponse.status, 200);
    let splitResult = await splitResponse.json();
    assert.equal(splitResult.state.transactionSplits.length, 2);
    assert.equal(splitResult.state.transactions[0].amount, 1250);
    assert.equal(
      splitResult.state.savedViews[0].name,
      "Needs review this month",
    );
    const bulk = bulkEditPlan(splitResult.state, ["statement-tx"], {
      category: "dining",
      includeSplits: true,
      review: "needs-review",
    });
    const bulkResponse = await fetch(origin + "/api/state", {
      method: "PUT",
      headers,
      body: JSON.stringify({
        state: bulk.next,
        revision: splitResult.revision,
      }),
    });
    assert.equal(bulkResponse.status, 200);
    splitResult = await bulkResponse.json();
    assert.equal(splitResult.state.transactions[0].amount, 1250);
    assert.ok(
      splitResult.state.transactionSplits.every((s) => s.category === "dining"),
    );
    assert.equal(splitResult.state.transactions[0].review, true);
    const invalidViewResponse = await fetch(origin + "/api/state", {
      method: "PUT",
      headers,
      body: JSON.stringify({
        state: {
          ...splitResult.state,
          savedViews: [
            { ...splitResult.state.savedViews[0], dateMode: "unknown" },
          ],
        },
        revision: splitResult.revision,
      }),
    });
    assert.equal(invalidViewResponse.status, 400);

    const invalidSplit = {
      ...splitResult.state,
      transactionSplits: splitResult.state.transactionSplits.map((s, i) =>
        i ? s : { ...s, amount: 501 },
      ),
    };
    const mismatch = await fetch(origin + "/api/state", {
      method: "PUT",
      headers,
      body: JSON.stringify({
        state: invalidSplit,
        revision: splitResult.revision,
      }),
    });
    assert.equal(mismatch.status, 400);
    assert.match((await mismatch.json()).error, /original transaction total/);
    const undoResponse = await fetch(origin + "/api/state", {
      method: "PUT",
      headers,
      body: JSON.stringify({
        state: undoImport(splitResult.state, "statement-batch", {
          removeEdited: true,
        }),
        revision: splitResult.revision,
      }),
    });
    assert.equal(undoResponse.status, 200);
    const undone = await undoResponse.json();
    assert.equal(undone.state.transactions.length, 0);
    assert.equal(undone.state.transactionSplits.length, 0);
    assert.equal(undone.state.importBatches[0].status, "undone");
    assert.equal(undone.state.importEntries.length, 1);
    const readAgain = await fetch(origin + "/api/state", {
      headers: { authorization: auth },
    });
    assert.equal(
      (await readAgain.json()).state.importBatches[0].status,
      "undone",
    );
    const recovery = async (payload) => {
      const response = await fetch(origin + "/api/recovery", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      assert.equal(response.status, 200, result.error);
      return result;
    };
    assert.equal((await fetch(origin + "/api/recovery")).status, 401);
    assert.equal(
      (
        await fetch(origin + "/api/recovery", {
          method: "POST",
          headers: { authorization: auth, "Content-Type": "application/json" },
          body: JSON.stringify({ action: "create" }),
        })
      ).status,
      403,
    );
    const backup = await recovery({
      action: "create",
      label: "HTTP restore point",
    });
    const portable = await recovery({ action: "export" });
    assert.equal(portable.mime, "application/zip");
    const csv = await recovery({ action: "csv", scope: "all" });
    assert.match(Buffer.from(csv.data, "base64").toString(), /Net Spending/);
    const safeFiles = await readFile(
      path.join(root, "vault", "Transactions.md"),
      "utf8",
    );
    await writeFile(
      path.join(root, "vault", "Transactions.md"),
      "Damaged table",
    );
    assert.equal(
      (await fetch(origin + "/api/state", { headers: { authorization: auth } }))
        .status,
      400,
    );
    const recoveryInfo = await (
      await fetch(origin + "/api/recovery", {
        headers: { authorization: auth },
      })
    ).json();
    assert.ok(recoveryInfo.currentError);
    assert.ok(recoveryInfo.backups.some((b) => b.id === backup.id && b.valid));
    assert.equal(recoveryInfo.folderPickerAvailable, false);
    const preview = await recovery({ action: "preview", id: backup.id });
    assert.ok(preview.currentError);
    const restored = await recovery({
      action: "restore",
      preview: preview.token,
    });
    assert.equal(restored.state.importBatches[0].status, "undone");
    assert.ok(restored.safetyBackup);
    assert.equal(
      await readFile(path.join(root, "vault", "Transactions.md"), "utf8"),
      safeFiles,
    );
    const zipPreview = await recovery({
      action: "import-preview",
      archive: portable.data,
    });
    const restoredNew = await recovery({
      action: "restore-new",
      preview: zipPreview.token,
      path: path.join(root, "new-vault"),
    });
    assert.equal(restoredNew.state.importBatches[0].status, "undone");
    assert.match(await readFile(path.join(root, ".env"), "utf8"), /VAULT_DIR=/);
    assert.ok(
      await readFile(path.join(root, "vault", "Transactions.md"), "utf8"),
    );
    await assert.rejects(readFile(path.join(root, "vault", ".clarity.lock")), {
      code: "ENOENT",
    });
    assert.ok(
      await readFile(path.join(root, "new-vault", ".clarity.lock"), "utf8"),
    );
    const picked = await fetch(origin + "/api/vault/pick", {
      method: "POST",
      headers,
      body: "{}",
    });
    assert.notEqual(picked.status, 200);
    assert.match((await picked.json()).error, /server mode/);
    // Reopen with a required table missing: recovery must work even when init fails.
    const stoppedForRecovery = new Promise((resolve) =>
      child.once("exit", resolve),
    );
    child.kill();
    await stoppedForRecovery;
    await unlink(path.join(root, "new-vault", "TransactionSplits.md"));
    child = startServer();
    let boot;
    for (let i = 0; i < 150; i++) {
      try {
        const response = await fetch(origin + "/api/recovery", {
          headers: { authorization: auth },
        });
        if (response.ok) {
          boot = await response.json();
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(boot, "recovery API starts with an unreadable ledger");
    assert.match(
      boot.currentError,
      /TransactionSplits.md is missing|Missing TransactionSplits.md/,
    );
    headers["X-Clarity-Token"] = boot.token;
    assert.equal(
      (await fetch(origin + "/api/state", { headers: { authorization: auth } }))
        .status,
      400,
    );
    const coldPreview = await recovery({
      action: "import-preview",
      archive: portable.data,
    });
    const coldRestore = await recovery({
      action: "restore",
      preview: coldPreview.token,
    });
    assert.equal(coldRestore.state.importBatches[0].status, "undone");
    assert.equal(
      (await fetch(origin + "/api/state", { headers: { authorization: auth } }))
        .status,
      200,
    );
    const movedResponse = await fetch(origin + "/api/vault", {
      method: "POST",
      headers,
      body: JSON.stringify({
        path: path.join(root, "moved-after-recovery"),
        revision: coldRestore.revision,
      }),
    });
    const moved = await movedResponse.json();
    assert.equal(movedResponse.status, 200, moved.error);
    assert.ok(
      await readFile(path.join(moved.vaultPath, ".clarity.lock"), "utf8"),
    );
    const returning = new Store(path.join(root, "previous-install-vault"));
    await returning.init();
    const returningInitial = await returning.read();
    const returningSaved = await returning.save(
      {
        ...returningInitial.state,
        displayName: "Returning installer",
        currency: "USD",
        theme: "midnight",
        onboardingCompleted: true,
        accounts: [
          { id: "old-account", name: "Previous account", type: "bank" },
        ],
        transactions: [
          {
            id: "old-purchase",
            kind: "expense",
            category: "groceries",
            account: "old-account",
            amount: 2500,
            date: "2026-10-18",
            merchant: "Old merchant",
            description: "Original purchase",
            source: "reviewed",
            review: false,
            location: "",
            reference: "",
          },
        ],
      },
      returningInitial.revision,
    );
    const openVault = async (payload) => {
      const response = await fetch(origin + "/api/vault/open", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      assert.equal(response.status, 200, result.error);
      return result;
    };
    assert.equal(
      (
        await fetch(origin + "/api/vault/open", {
          method: "POST",
          headers: { authorization: auth, "Content-Type": "application/json" },
          body: JSON.stringify({ action: "preview", path: returning.dir }),
        })
      ).status,
      403,
    );
    const existingPreview = await openVault({
      action: "preview",
      path: returning.dir,
    });
    assert.equal(existingPreview.transactions, 1);
    assert.equal(existingPreview.currency, "USD");
    const opened = await openVault({
      action: "open",
      preview: existingPreview.token,
    });
    assert.deepEqual(opened.state, returningSaved.state);
    assert.ok(
      await readFile(path.join(moved.vaultPath, "Accounts.md"), "utf8"),
    );
    await assert.rejects(
      readFile(path.join(moved.vaultPath, ".clarity.lock")),
      { code: "ENOENT" },
    );
    assert.ok(
      await readFile(path.join(opened.vaultPath, ".clarity.lock"), "utf8"),
    );
    const stoppedAfterMove = new Promise((resolve) =>
      child.once("exit", resolve),
    );
    child.kill();
    await stoppedAfterMove;
    await assert.rejects(
      readFile(path.join(moved.vaultPath, ".clarity.lock")),
      { code: "ENOENT" },
    );
    await assert.rejects(
      readFile(path.join(opened.vaultPath, ".clarity.lock")),
      { code: "ENOENT" },
    );
    child = startServer();
    let reopened;
    for (let i = 0; i < 150; i++) {
      try {
        const response = await fetch(origin + "/api/state", {
          headers: { authorization: auth },
        });
        if (response.ok) {
          reopened = await response.json();
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.deepEqual(reopened?.state, returningSaved.state);
    assert.equal(reopened.vaultPath, opened.vaultPath);
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      const stopped = new Promise((resolve) => child.once("exit", resolve));
      child.kill();
      await stopped;
    }
    await rm(root, { recursive: true, force: true });
  }
});

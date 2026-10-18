import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Store, schemas } from "./store.mjs";
import { prepareBackup } from "./backups.mjs";
import { fileFingerprint, safePath, limits } from "./vault-files.mjs";
import { lockVault } from "./vault-lock.mjs";
import { writeEnv } from "./local-settings.mjs";

export async function inspectExistingVault(directory) {
  if (
    typeof directory !== "string" ||
    !path.isAbsolute(directory) ||
    /[\r\n\0]/.test(directory)
  )
    throw Error("Choose the full path to your existing Clarity vault folder.");
  const info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink())
    throw Error("Choose a real vault folder, not a file or symbolic link.");
  const vaultPath = await realpath(directory),
    files = {};
  for (const name of [
    "Money.md",
    ...Object.keys(schemas).map((s) => s + ".md"),
  ]) {
    const file = await safePath(vaultPath, name);
    const info = await lstat(file).catch((e) => {
      if (e.code === "ENOENT") return null;
      throw e;
    });
    if (!info) continue;
    if (!info.isFile() || info.size > limits.file)
      throw Error(`Cannot safely read ${name}. Choose a valid Clarity vault.`);
    files[name] = await readFile(file);
  }
  if (
    !files["Settings.md"] &&
    !files["Money.md"]?.includes(Buffer.from("<!-- folio:start -->"))
  )
    throw Error(
      "This folder is not a Clarity vault. Choose the folder containing Money.md and your financial Markdown files.",
    );
  const pending = await lstat(path.join(vaultPath, ".pending-save.md")).catch(
    (e) => {
      if (e.code === "ENOENT") return null;
      throw e;
    },
  );
  if (pending)
    throw Error(
      "This vault has an interrupted save. Reopen it through the desktop startup chooser to finish recovery before switching folders.",
    );
  const prepared = prepareBackup(files);
  return {
    vaultPath,
    files,
    fingerprint: fileFingerprint(files),
    state: prepared.state,
    olderFormat: prepared.missingOptional.length > 0 || !files["Settings.md"],
  };
}
export class VaultOpener {
  constructor(store, root) {
    this.store = store;
    this.root = root;
    this.plans = new Map();
  }
  async preview(directory) {
    await this.store.queue;
    const source = await inspectExistingVault(directory);
    const current = await realpath(this.store.dir);
    if (
      source.vaultPath !== current &&
      (source.vaultPath.startsWith(current + path.sep) ||
        current.startsWith(source.vaultPath + path.sep))
    )
      throw Error("Choose a vault outside the current vault folder.");
    const token = randomUUID();
    this.plans.clear();
    this.plans.set(token, {
      path: source.vaultPath,
      fingerprint: source.fingerprint,
      current,
      time: Date.now(),
    });
    return {
      token,
      vaultPath: source.vaultPath,
      displayName: source.state.displayName,
      currency: source.state.currency,
      theme: source.state.theme,
      transactions: source.state.transactions.length,
      accounts: source.state.accounts.length,
      balances: source.state.balances.length,
      categories: source.state.categories.length,
      savedViews: source.state.savedViews.length,
      olderFormat: source.olderFormat,
    };
  }
  async open(token) {
    await this.store.queue;
    const plan = this.plans.get(token);
    if (
      !plan ||
      Date.now() - plan.time > 600000 ||
      (await realpath(this.store.dir)) !== plan.current
    )
      throw Error("The vault preview expired. Check the folder again.");
    const same = plan.path === plan.current,
      targetStore = same ? this.store : new Store(plan.path);
    const release = same ? null : await lockVault(targetStore);
    try {
      const current = await inspectExistingVault(plan.path);
      if (current.fingerprint !== plan.fingerprint) {
        const e = Error(
          "The selected vault changed. Check the folder again before opening it.",
        );
        e.status = 409;
        throw e;
      }
      await targetStore.init(); // Older vaults migrate with the existing recovery backup.
      const result = await targetStore.read();
      await writeEnv(this.root, { VAULT_DIR: plan.path });
      this.plans.clear();
      return { ...result, vaultPath: plan.path, targetStore, release };
    } catch (e) {
      release?.();
      throw e;
    }
  }
}

import {
  mkdir,
  readFile,
  readdir,
  lstat,
  rename,
  rm,
  rmdir,
  realpath,
} from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  Store,
  schemas,
  deserialize,
  splitFiles,
  joinFiles,
} from "./store.mjs";
import {
  collectVault,
  fileFingerprint,
  hash,
  manifestFor,
  writeManifest,
  writeFiles,
  safePath,
  safeVaultName,
  readValue,
  limits,
} from "./vault-files.mjs";
import { exportArchive, importArchive } from "./backup-archive.mjs";

const managed = () => Object.keys(schemas).map((s) => s + ".md");
const ids = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,150}$/;
const text = (buf) => new TextDecoder("utf-8", { fatal: true }).decode(buf);
const serialRows = (state) => ({
  Transactions: state.transactions,
  TransactionSplits: state.transactionSplits,
  Accounts: state.accounts,
  Categories: state.categories,
  Balances: state.balances,
  ImportBatches: state.importBatches,
  StatementCoverage: state.statementCoverage,
  MerchantRules: state.merchantRules,
  ImportEntries: state.importEntries,
  ImportProfiles: state.importProfiles,
  ChartPreferences: state.chartPreferences,
  SavedViews: state.savedViews,
  Settings: [
    {
      id: "settings",
      currency: state.currency,
      theme: state.theme,
      displayName: state.displayName,
      model: state.model,
      onboardingCompleted: state.onboardingCompleted,
    },
  ],
  BudgetOverrides: state.budgetOverrides,
});
const portableKey = (name) => name.normalize("NFC").toLowerCase();
function pathConflicts(current, incoming) {
  const existing = new Map(
    Object.keys(current).map((name) => [portableKey(name), name]),
  );
  return Object.keys(incoming).filter(
    (name) =>
      existing.has(portableKey(name)) &&
      existing.get(portableKey(name)) !== name,
  );
}
export function prepareBackup(files, metadata = {}) {
  if (
    metadata.schema &&
    (!Array.isArray(metadata.schema) ||
      metadata.schema.some((name) => !Object.hasOwn(schemas, name)))
  )
    throw Error("This backup uses a newer or unsupported data schema.");
  if (
    metadata.scope === "data" &&
    Object.keys(files).some(
      (name) => name !== "Money.md" && !managed().includes(name),
    )
  )
    throw Error(
      "Data snapshot contains unexpected notes or attachments. Use a vault backup for those files.",
    );
  const strings = Object.fromEntries(
    managed()
      .filter((name) => files[name])
      .map((name) => [name, text(files[name])]),
  );
  let state;
  const index = files["Money.md"] ? text(files["Money.md"]) : null;
  if (!Object.keys(strings).length && index?.includes("<!-- folio:start -->"))
    state = deserialize(index);
  else {
    for (const name of [
      "Settings.md",
      "Accounts.md",
      "Categories.md",
      "Transactions.md",
      "Balances.md",
    ])
      if (!strings[name])
        throw Error(`Incomplete data snapshot: ${name} is missing.`);
    for (const section of Object.keys(schemas))
      if (index?.includes(`[[${section}]]`) && !strings[section + ".md"])
        throw Error(`Incomplete snapshot: ${section}.md is missing.`);
    state = deserialize(joinFiles(strings));
  }
  const normalized = splitFiles(state, strings);
  // Keep current table files byte-for-byte, including user notes. Only older
  // schemas need normalization to add missing columns or tables.
  for (const [section, columns] of Object.entries(schemas)) {
    const name = section + ".md",
      raw = strings[name];
    const header = raw?.split("\n").find((line) => line.trim().startsWith("|"));
    const cells = header?.split("|").map((cell) => cell.trim()) || [];
    if (columns.every((column) => cells.includes(column)))
      normalized[name] = raw;
  }
  normalized["Money.md"] =
    index && !index.includes("<!-- folio:start -->")
      ? index
      : "# My money journal\n\n" +
        Object.keys(schemas)
          .map((s) => `- [[${s}]]`)
          .join("\n") +
        "\n\n## Notes\n\n";
  // Preserve notes from a legacy single-file ledger when converting it to tables.
  if (index?.includes("<!-- folio:end -->"))
    normalized["Money.md"] += index
      .split("<!-- folio:end -->")
      .slice(1)
      .join("<!-- folio:end -->");
  for (const section of Object.keys(schemas))
    if (!normalized["Money.md"].includes(`[[${section}]]`))
      normalized["Money.md"] += `\n- [[${section}]]\n`;
  const output = Object.fromEntries(
    Object.entries(normalized).map(([name, raw]) => [name, Buffer.from(raw)]),
  );
  for (const [name, data] of Object.entries(files))
    if (!Object.hasOwn(output, name)) output[name] = data;
  const portableNames = Object.keys(output).map(portableKey),
    portableSet = new Set(portableNames);
  if (
    portableSet.size !== portableNames.length ||
    portableNames.some((name) =>
      name
        .split("/")
        .slice(0, -1)
        .some((_, index) =>
          portableSet.has(
            name
              .split("/")
              .slice(0, index + 1)
              .join("/"),
          ),
        ),
    )
  )
    throw Error("Backup contains conflicting file or folder names.");
  if (
    Object.keys(output).length > limits.count ||
    Object.values(output).some((data) => data.length > limits.file) ||
    Object.values(output).reduce((sum, data) => sum + data.length, 0) >
      limits.total
  )
    throw Error("Normalized backup exceeds recovery size limits.");
  return {
    state,
    files: output,
    metadata,
    missingOptional: managed().filter(
      (name) =>
        !files[name] &&
        ![
          "Settings.md",
          "Accounts.md",
          "Categories.md",
          "Transactions.md",
          "Balances.md",
        ].includes(name),
    ),
  };
}
function changes(before, after) {
  const result = [];
  for (const [name, records] of Object.entries(serialRows(after))) {
    const old = new Map((serialRows(before)[name] || []).map((r) => [r.id, r]));
    const next = new Map((records || []).map((r) => [r.id, r]));
    result.push({
      name,
      before: old.size,
      after: next.size,
      added: [...next.keys()].filter((id) => !old.has(id)).length,
      removed: [...old.keys()].filter((id) => !next.has(id)).length,
      changed: [...next].filter(
        ([id, r]) =>
          old.has(id) && JSON.stringify(old.get(id)) !== JSON.stringify(r),
      ).length,
    });
  }
  return result;
}
export class Backups {
  constructor(store) {
    this.store = store;
    this.plans = new Map();
  }
  async root() {
    const root = await safePath(this.store.dir, ".backups", true);
    await mkdir(root, { recursive: true });
    return root;
  }
  async read(id) {
    if (typeof id !== "string" || !ids.test(id))
      throw Error("Invalid backup ID.");
    const root = await this.root(),
      file = path.join(root, id),
      info = await lstat(file);
    if (info.isSymbolicLink())
      throw Error("Symbolic-link backups are not supported.");
    if (info.isFile()) {
      if (!id.endsWith(".md") || info.size > limits.file)
        throw Error("Unsupported backup file.");
      const data = await readFile(file);
      return {
        bytes: info.size,
        ...prepareBackup(
          { "Money.md": data },
          {
            kind: "legacy",
            scope: "data",
            label: "Legacy data backup",
            createdAt: new Date(info.mtimeMs).toISOString(),
          },
        ),
      };
    }
    if (!info.isDirectory()) throw Error("Unsupported backup.");
    const collected = await collectVault(file);
    let metadata = {
      kind: id.startsWith("upgrade-") ? "upgrade" : "legacy",
      scope: "data",
      label: "Older data snapshot",
      createdAt: new Date(info.mtimeMs).toISOString(),
    };
    const manifestInfo = await lstat(path.join(file, ".backup.md")).catch(
      (e) => {
        if (e.code === "ENOENT") return null;
        throw e;
      },
    );
    if (
      manifestInfo &&
      (!manifestInfo.isFile() ||
        manifestInfo.isSymbolicLink() ||
        manifestInfo.size > 1024 * 1024)
    )
      throw Error("Unsafe or oversized backup metadata.");
    const rawManifest = await readFile(
      path.join(file, ".backup.md"),
      "utf8",
    ).catch((e) => {
      if (e.code === "ENOENT") return null;
      throw e;
    });
    if (rawManifest) {
      const match = rawManifest.match(/```json\n([\s\S]*?)\n```/);
      if (!match) throw Error("Backup metadata is malformed.");
      metadata = JSON.parse(match[1]);
      if (
        metadata.format !== "clarity-vault" ||
        metadata.version !== 1 ||
        !["data", "vault"].includes(metadata.scope) ||
        !metadata.files ||
        typeof metadata.files !== "object" ||
        Array.isArray(metadata.files) ||
        typeof metadata.createdAt !== "string" ||
        !Number.isFinite(Date.parse(metadata.createdAt))
      )
        throw Error("Unsupported backup metadata.");
      if (
        Object.keys(metadata.files).length !==
        Object.keys(collected.files).length
      )
        throw Error("Backup files are missing or unexpected.");
      for (const [name, digest] of Object.entries(metadata.files))
        if (
          !safeVaultName(name) ||
          !collected.files[name] ||
          hash(collected.files[name]) !== digest
        )
          throw Error(
            "Backup integrity check failed: files are missing or changed.",
          );
    }
    return {
      ...prepareBackup(collected.files, metadata),
      bytes: collected.total,
    };
  }
  async list() {
    const root = await this.root(),
      entries = await readdir(root, { withFileTypes: true }),
      backups = [];
    for (const entry of entries) {
      if (!ids.test(entry.name) || entry.name.startsWith(".")) continue;
      try {
        const source = await this.read(entry.name);
        const counts = Object.fromEntries(
          Object.entries(serialRows(source.state)).map(([key, rows]) => [
            key,
            (rows || []).length,
          ]),
        );
        backups.push({
          id: entry.name,
          valid: true,
          kind: source.metadata.kind || "legacy",
          scope: source.metadata.scope || "data",
          label: String(source.metadata.label || "Backup").slice(0, 100),
          createdAt: source.metadata.createdAt,
          bytes: source.bytes || 0,
          counts,
          missingOptional: source.missingOptional,
        });
      } catch (e) {
        backups.push({
          id: entry.name,
          valid: false,
          label: entry.name,
          error: e.message,
        });
      }
    }
    return backups.sort((a, b) =>
      (b.createdAt || "").localeCompare(a.createdAt || ""),
    );
  }
  async create(label = "Named backup", kind = "manual", requireValid = true) {
    await this.store.queue;
    if (requireValid) await this.store.recover();
    if (typeof label !== "string") throw Error("Backup name must be text.");
    const current = await collectVault(this.store.dir);
    if (requireValid) prepareBackup(current.files);
    const id = `${kind}-${Date.now()}-${randomUUID()}`,
      root = await this.root(),
      destination = path.join(root, id);
    await mkdir(destination);
    try {
      await writeFiles(destination, current.files);
      await writeManifest(
        destination,
        manifestFor(current.files, {
          label: String(label).trim().slice(0, 100) || "Named backup",
          kind,
          scope: "vault",
          schema: Object.keys(schemas),
          skipped: current.skipped,
        }),
      );
    } catch (e) {
      await rm(destination, { recursive: true, force: true });
      throw e;
    }
    return { id, skipped: current.skipped };
  }
  async preview({ id, archive } = {}) {
    await this.store.queue;
    const source = archive
      ? (() => {
          const unpacked = importArchive(archive);
          return prepareBackup(unpacked.files, unpacked.metadata);
        })()
      : await this.read(id);
    const current = await collectVault(this.store.dir);
    let previous = null,
      currentError = "";
    try {
      previous = prepareBackup(current.files).state;
    } catch (e) {
      currentError = e.message;
    }
    for (const [key, plan] of this.plans)
      if (Date.now() - plan.time > 600000) this.plans.delete(key);
    if (this.plans.size >= 3) this.plans.delete(this.plans.keys().next().value);
    const token = randomUUID(),
      fingerprint = fileFingerprint(current.files);
    this.plans.set(token, {
      ...source,
      fingerprint,
      vault: this.store.dir,
      time: Date.now(),
    });
    const fileChanges = Object.entries(source.files).map(([name, data]) => ({
      name,
      action: !current.files[name]
        ? "add"
        : hash(data) !== hash(current.files[name])
          ? "replace"
          : "unchanged",
    }));
    return {
      token,
      currentError,
      scope: source.metadata.scope || "data",
      label: source.metadata.label || "Backup",
      changes: previous ? changes(previous, source.state) : [],
      totals: Object.fromEntries(
        Object.entries(serialRows(source.state)).map(([key, rows]) => [
          key,
          (rows || []).length,
        ]),
      ),
      currency: {
        before: previous?.currency || "Unknown",
        after: source.state.currency,
      },
      missingOptional: source.missingOptional,
      files: fileChanges,
      keptFiles: Object.keys(current.files).filter(
        (name) => !source.files[name],
      ),
      skipped: current.skipped,
      pathConflicts: pathConflicts(current.files, source.files),
    };
  }
  plan(token) {
    const plan = this.plans.get(token);
    if (
      !plan ||
      Date.now() - plan.time > 600000 ||
      plan.vault !== this.store.dir
    )
      throw Error("Restore preview expired. Preview the backup again.");
    return plan;
  }
  async restore(token) {
    await this.store.queue;
    const plan = this.plan(token);
    // Never overwrite an unresolved save journal from another recovery attempt.
    await this.store.recover();
    const current = await collectVault(this.store.dir);
    if (fileFingerprint(current.files) !== plan.fingerprint) {
      const e = Error(
        "Your vault changed after preview. Preview the backup again before restoring.",
      );
      e.status = 409;
      throw e;
    }
    if (pathConflicts(current.files, plan.files).length)
      throw Error(
        "Current and backup filenames differ only by case or Unicode normalization. Restore into a new folder instead.",
      );
    const safety = await this.create(
      "Before restore — recovery copy",
      "safety",
      false,
    );
    const next = {},
      old = {};
    for (const [name, data] of Object.entries(plan.files)) {
      const isText = managed().includes(name) || name === "Money.md";
      next[name] = isText
        ? text(data)
        : { encoding: "base64", data: data.toString("base64") };
      old[name] = await readValue(this.store.dir, name, !isText);
    }
    const verified = await collectVault(this.store.dir);
    if (fileFingerprint(verified.files) !== plan.fingerprint)
      throw Error(
        "Files changed while preparing recovery. Nothing was restored; the safety copy is retained.",
      );
    await this.store.commitFiles(next, old);
    this.plans.clear();
    return { ...(await this.store.read()), safetyBackup: safety.id };
  }
  async restoreNew(token, destination) {
    await this.store.queue;
    const plan = this.plan(token);
    if (
      typeof destination !== "string" ||
      !path.isAbsolute(destination) ||
      /[\r\n\0]/.test(destination)
    )
      throw Error("Choose a full path to a new or empty folder.");
    await mkdir(path.dirname(destination), { recursive: true });
    const target = path.join(
      await realpath(path.dirname(destination)),
      path.basename(destination),
    );
    const source = await realpath(this.store.dir);
    if (
      target === source ||
      target.startsWith(source + path.sep) ||
      source.startsWith(target + path.sep)
    )
      throw Error("Choose a folder outside the current vault.");
    const info = await lstat(target).catch((e) => {
      if (e.code === "ENOENT") return null;
      throw e;
    });
    if (
      info &&
      (!info.isDirectory() ||
        info.isSymbolicLink() ||
        (await readdir(target)).length)
    )
      throw Error(
        "Choose a new or empty folder. Existing files will not be overwritten.",
      );
    const staging = target + ".restore-" + randomUUID();
    try {
      await writeFiles(staging, plan.files);
      const staged = new Store(staging);
      await staged.init();
      await staged.read();
      if (info) await rmdir(target);
      await rename(staging, target);
    } catch (e) {
      await rm(staging, { recursive: true, force: true });
      throw e;
    }
    this.plans.clear();
    return target;
  }
  async export() {
    await this.store.queue;
    await this.store.recover();
    const current = await collectVault(this.store.dir);
    prepareBackup(current.files);
    return {
      archive: exportArchive(current.files, { schema: Object.keys(schemas) }),
      skipped: current.skipped,
    };
  }
}

"use client";
import { useEffect, useState } from "react";
import {
  Archive,
  Download,
  FolderOpen,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import useFolderPicker from "./use-folder-picker";

function download(result) {
  const binary = atob(result.data),
    bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: result.mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = result.filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const recordNames = {
  TransactionSplits: "Split allocations",
  SavedViews: "Saved views",
  ImportBatches: "Statement history",
  StatementCoverage: "Statement coverage",
  MerchantRules: "Merchant rules",
  ImportEntries: "Import references",
  ImportProfiles: "Import configurations",
  ChartPreferences: "Chart preferences",
  BudgetOverrides: "Monthly budget changes",
};
const size = (n) =>
  n >= 1024 * 1024
    ? (n / 1024 / 1024).toFixed(1) + " MB"
    : Math.ceil(n / 1024) + " KB";
export default function RecoveryPanel({
  api,
  meta,
  onMeta,
  onRestored,
  busy = false,
  onWorking,
  filteredIds = [],
  filteredCategory = "all",
  periodLabel = "selected view",
  Modal,
  Button,
  Field,
}) {
  const [items, setItems] = useState([]),
    [loading, setLoading] = useState(true),
    [running, setRunning] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [currentError, setCurrentError] = useState("");
  const [label, setLabel] = useState(""),
    [preview, setPreview] = useState(null),
    [ack, setAck] = useState(false),
    [mode, setMode] = useState("current"),
    [destination, setDestination] = useState(""),
    [csvScope, setCsvScope] = useState("all");
  const folderPicker = useFolderPicker(api, setDestination, setError);
  const disabled = running || busy;
  async function load() {
    setLoading(true);
    try {
      const result = await api("recovery", undefined, "GET");
      setItems(result.backups);
      setCurrentError(result.currentError || "");
      onMeta?.({
        token: result.token,
        vaultPath: result.vaultPath,
        platform: result.platform,
        folderPickerAvailable: result.folderPickerAvailable,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function run(task) {
    setRunning(true);
    onWorking?.(true);
    setError("");
    setMessage("");
    try {
      await task();
    } catch (e) {
      setError(e.message);
    } finally {
      setRunning(false);
      onWorking?.(false);
    }
  }
  function showPreview(result) {
    setPreview(result);
    setAck(false);
    setMode(result.pathConflicts?.length ? "new" : "current");
    setDestination("");
  }
  return (
    <section className="panel settings-section recovery-panel">
      <div className="settings-heading">
        <ShieldCheck size={22} />
        <div>
          <h2>Data & recovery</h2>
          <p>
            Local restore points, portable backups, and exports. No cloud
            upload.
          </p>
        </div>
      </div>
      <p className="notice">
        Automatic snapshots keep the previous state of your managed Markdown
        files for the latest 30 saves—not 30 days. Named backups and pre-restore
        safety copies are kept separately. A backup on the same drive does not
        protect against losing that drive.
      </p>
      {currentError && (
        <p className="notice danger" role="alert">
          <strong>Your current ledger needs recovery.</strong> {currentError}{" "}
          Valid backups can still be previewed and restored below.
        </p>
      )}
      {error && (
        <p className="notice danger" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      <div className="recovery-tools">
        <div className="recovery-tool">
          <h3>Keep a restore point</h3>
          <Field label="Backup name (optional)">
            <input
              maxLength={100}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Before reorganizing my categories"
            />
          </Field>
          <Button
            disabled={disabled || !!currentError}
            onClick={() =>
              run(async () => {
                const result = await api("recovery", {
                  action: "create",
                  label,
                });
                setMessage(
                  `Named backup created. It will not be removed by the 30-save rotation.${result.skipped.length ? ` ${result.skipped.length} unsupported files were excluded.` : ""}`,
                );
                setLabel("");
                await load();
              })
            }
          >
            <Archive size={15} />
            Back up now
          </Button>
        </div>
        <div className="recovery-tool">
          <h3>Portable vault backup</h3>
          <p>
            Export financial Markdown, notes, and supported attachments.
            Clarity’s API keys, connection credentials, hidden folders, and
            backup history are excluded. ZIPs are readable and unencrypted.
          </p>
          <Button
            disabled={disabled || !!currentError}
            onClick={() =>
              run(async () => {
                const result = await api("recovery", { action: "export" });
                download(result);
                setMessage(
                  `Vault ZIP downloaded.${result.skipped.length ? ` Excluded: ${result.skipped.slice(0, 10).join(", ")}${result.skipped.length > 10 ? "…" : ""}` : ""}`,
                );
              })
            }
          >
            <Download size={15} />
            Export vault ZIP
          </Button>
          <Field label="Import a Clarity backup ZIP">
            <input
              type="file"
              accept=".zip,application/zip"
              disabled={disabled}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                run(async () => {
                  if (file.size > 32 * 1024 * 1024)
                    throw Error("Choose a Clarity ZIP smaller than 32 MB.");
                  const encoded = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () =>
                      resolve(String(reader.result).split(",")[1]);
                    reader.onerror = () =>
                      reject(Error("Could not read this ZIP."));
                    reader.readAsDataURL(file);
                  });
                  showPreview(
                    await api("recovery", {
                      action: "import-preview",
                      archive: encoded,
                    }),
                  );
                });
              }}
            />
          </Field>
          <small>
            Import validates the archive and previews changes first. It does not
            restore immediately.
          </small>
        </div>
        <div className="recovery-tool">
          <h3>Export transactions</h3>
          <Field label="CSV scope">
            <select
              value={csvScope}
              onChange={(e) => setCsvScope(e.target.value)}
            >
              <option value="all">All transactions</option>
              <option value="filtered">
                Current range and filters · {periodLabel}
              </option>
            </select>
          </Field>
          <p>
            Splits export one row per allocation. Amount and Net Spending are
            additive; Original Total appears once per transaction. CSV is for
            analysis, not full-vault recovery.
          </p>
          <Button
            disabled={disabled || !!currentError}
            onClick={() =>
              run(async () => {
                download(
                  await api("recovery", {
                    action: "csv",
                    scope: csvScope,
                    ids: filteredIds,
                    category: filteredCategory,
                  }),
                );
                setMessage("Transaction CSV downloaded.");
              })
            }
          >
            <Download size={15} />
            Export CSV
          </Button>
        </div>
      </div>
      <div className="recovery-list-heading">
        <div>
          <h3>Available restore points</h3>
          <p>
            Data snapshots restore financial tables and their notes. Vault
            backups also contain included notes and attachments.
          </p>
        </div>
        <Button disabled={disabled || loading} onClick={load}>
          Refresh list
        </Button>
        {meta.platform === "desktop" && (
          <Button
            disabled={disabled}
            onClick={() =>
              run(async () => {
                await api("recovery", { action: "open-folder" });
                setMessage("Backup folder opened.");
              })
            }
          >
            <FolderOpen size={15} />
            Open backup folder
          </Button>
        )}
      </div>
      <code className="path">
        {meta.vaultPath}
        {meta.vaultPath?.includes("\\") ? "\\" : "/"}.backups
      </code>
      {loading && (
        <p className="notice" role="status">
          Checking local backups…
        </p>
      )}
      {!loading && !items.length && (
        <p className="notice">
          No backups yet. Use Back up now, or make a change to create an
          automatic snapshot.
        </p>
      )}
      <div className="recovery-backups">
        {items.map((item) => (
          <article className="recovery-backup" key={item.id}>
            <div>
              <strong>{item.label}</strong>
              <p>
                {item.createdAt && new Date(item.createdAt).toLocaleString()} ·{" "}
                {item.valid
                  ? `${item.kind} · ${item.scope === "vault" ? "Vault backup" : "Data snapshot"} · ${size(item.bytes)}`
                  : "Not restorable"}
              </p>
              {item.valid ? (
                <p>
                  {item.counts.Transactions} transactions ·{" "}
                  {item.counts.TransactionSplits} allocations ·{" "}
                  {item.counts.Accounts} accounts
                  {item.missingOptional.length > 0 &&
                    " · Older format: some optional tables are absent"}
                </p>
              ) : (
                <p className="recovery-error">{item.error}</p>
              )}
            </div>
            <Button
              disabled={disabled || !item.valid}
              onClick={() =>
                run(async () =>
                  showPreview(
                    await api("recovery", { action: "preview", id: item.id }),
                  ),
                )
              }
            >
              <RotateCcw size={15} />
              Preview restore
            </Button>
          </article>
        ))}
      </div>
      <p className="form-note">
        Supported archives: up to 32 MB compressed, 64 MB expanded, 16 MB per
        file, and 1,000 files. Symbolic links and unsupported files are excluded
        from exports. Keep another copy on a different drive if you want
        protection from drive loss.
      </p>
      {preview && (
        <Modal
          wide
          title="Review restoration"
          subtitle={preview.label}
          onClose={() => {
            if (!running) {
              folderPicker.cancel();
              setPreview(null);
            }
          }}
        >
          <div className="form-body">
            <p className="notice danger">
              Restoring replaces financial records and the included files. An
              automatic safety copy is created before replacing the current
              vault. API keys and connection credentials are never restored.
            </p>
            {error && (
              <p className="notice danger" role="alert">
                {error}
              </p>
            )}
            {!!preview.pathConflicts?.length && (
              <p className="notice danger">
                Some filenames differ only by capitalization or Unicode
                spelling: {preview.pathConflicts.join(", ")}. Restore into a new
                folder to keep both copies safe.
              </p>
            )}
            {preview.currentError && (
              <p className="notice danger">
                The current ledger cannot be compared: {preview.currentError}.
                Source record counts are shown below. A raw safety copy of the
                current files will be kept.
              </p>
            )}
            <p>
              Currency:{" "}
              <strong>
                {preview.currency.before} → {preview.currency.after}
              </strong>{" "}
              ·{" "}
              {preview.scope === "vault"
                ? "Vault backup with included notes and attachments"
                : "Data snapshot; separate notes and attachments are not included"}
            </p>
            {preview.missingOptional.length > 0 && (
              <p className="notice danger">
                Older backup: these optional tables are absent and will be empty
                after restore: {preview.missingOptional.join(", ")}. Review the
                counts carefully.
              </p>
            )}
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Records</th>
                    <th>Now</th>
                    <th>After</th>
                    <th>Added</th>
                    <th>Removed</th>
                    <th>Changed</th>
                  </tr>
                </thead>
                <tbody>
                  {(preview.changes.length
                    ? preview.changes
                    : Object.entries(preview.totals).map(([name, after]) => ({
                        name,
                        after,
                      }))
                  ).map((row) => (
                    <tr key={row.name}>
                      <td>{recordNames[row.name] || row.name}</td>
                      <td>{row.before ?? "Unknown"}</td>
                      <td>{row.after}</td>
                      <td>{row.added ?? "—"}</td>
                      <td>{row.removed ?? "—"}</td>
                      <td>{row.changed ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <details>
              <summary>Files to restore ({preview.files.length})</summary>
              <ul>
                {preview.files.map((f) => (
                  <li key={f.name}>
                    {f.action}: {f.name}
                  </li>
                ))}
              </ul>
            </details>
            {preview.keptFiles.length > 0 && (
              <details>
                <summary>
                  Current-only files kept for in-place restore (
                  {preview.keptFiles.length})
                </summary>
                <ul>
                  {preview.keptFiles.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
                <p>
                  These files are not copied when restoring into a new folder.
                </p>
              </details>
            )}
            <Field label="Restore destination">
              <select
                disabled={running}
                value={mode}
                onChange={(e) => {
                  setMode(e.target.value);
                  setAck(false);
                }}
              >
                <option
                  value="current"
                  disabled={!!preview.pathConflicts?.length}
                >
                  Replace data in the current vault
                </option>
                <option value="new">
                  Restore into a new folder and use that vault
                </option>
              </select>
            </Field>
            {mode === "new" && (
              <>
                <Field label="New or empty folder">
                  <input
                    disabled={running}
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="Choose a folder for the restored vault"
                  />
                </Field>
                {meta.folderPickerAvailable && (
                  <Button
                    disabled={running || folderPicker.picking}
                    onClick={folderPicker.pick}
                  >
                    <FolderOpen size={15} />
                    Choose folder
                  </Button>
                )}
                <p className="notice">
                  Your current vault stays intact. Clarity switches to the
                  restored copy after verifying it. Existing destination files
                  will not be overwritten.
                </p>
              </>
            )}
            <label className="check-label">
              <input
                type="checkbox"
                checked={ack}
                onChange={(e) => setAck(e.target.checked)}
                disabled={running}
              />
              I reviewed these changes and want to restore this backup.
            </label>
          </div>
          <div className="dialog-actions">
            <Button
              disabled={running}
              onClick={() => {
                folderPicker.cancel();
                setPreview(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={
                disabled || !ack || (mode === "new" && !destination.trim())
              }
              onClick={() =>
                run(async () => {
                  const result = await api("recovery", {
                    action: mode === "new" ? "restore-new" : "restore",
                    preview: preview.token,
                    path: destination.trim(),
                  });
                  setPreview(null);
                  onRestored(result);
                })
              }
            >
              {running ? "Restoring…" : "Restore backup"}
            </Button>
          </div>
        </Modal>
      )}
    </section>
  );
}

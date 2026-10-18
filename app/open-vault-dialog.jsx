"use client";
import { useEffect, useRef, useState } from "react";
import { FolderOpen, ShieldCheck, X } from "lucide-react";
import useFolderPicker from "./use-folder-picker";

export default function OpenVaultDialog({ api, meta, onOpened, onClose }) {
  const ref = useRef(null),
    [path, setPath] = useState(""),
    [preview, setPreview] = useState(null),
    [error, setError] = useState(""),
    [working, setWorking] = useState(false);
  const picker = useFolderPicker(
    api,
    (value) => {
      setPath(value);
      setPreview(null);
    },
    setError,
  );
  useEffect(() => {
    ref.current.showModal();
  }, []);
  function close() {
    if (!working) {
      picker.cancel();
      onClose();
    }
  }
  return (
    <dialog
      ref={ref}
      className="open-vault-dialog"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <div className="dialog-head">
        <div>
          <h2>Open an existing vault</h2>
          <p>Reinstalling Clarity? Pick the folder you used before.</p>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Close existing vault dialog"
          disabled={working}
          onClick={close}
        >
          <X size={20} />
        </button>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          picker.cancel();
          setWorking(true);
          setError("");
          try {
            if (!preview)
              setPreview(
                await api("vault/open", {
                  action: "preview",
                  path: path.trim(),
                }),
              );
            else {
              const result = await api("vault/open", {
                action: "open",
                preview: preview.token,
              });
              onOpened(result);
              onClose();
            }
          } catch (e) {
            setError(e.message);
            setPreview(null);
          } finally {
            setWorking(false);
          }
        }}
      >
        <div className="form-body">
          <p>
            Your accounts, transactions, budgets, balances, saved views, and
            preferences are read from that folder. Your current vault stays
            where it is; files are not merged.
          </p>
          {error && (
            <p className="notice danger" role="alert">
              {error}
            </p>
          )}
          <label className="field">
            <span>
              {meta.platform === "server"
                ? "Existing vault folder on the server"
                : "Existing vault folder"}
            </span>
            <input
              aria-label="Existing vault folder"
              value={path}
              onChange={(e) => {
                setPath(e.target.value);
                setPreview(null);
                setError("");
              }}
              placeholder="Choose the folder containing Money.md"
              required
              disabled={working}
              spellCheck={false}
            />
          </label>
          {meta.folderPickerAvailable !== false && (
            <button
              type="button"
              className="btn"
              disabled={working || picker.picking}
              onClick={picker.pick}
            >
              <FolderOpen size={16} />
              {picker.picking ? "Choosing folder…" : "Choose existing folder…"}
            </button>
          )}
          {picker.picking && (
            <button type="button" className="btn" onClick={picker.cancel}>
              Cancel folder picker
            </button>
          )}
          {preview && (
            <section
              className="existing-vault-preview"
              aria-label="Existing vault preview"
            >
              <h3>
                {preview.displayName
                  ? `${preview.displayName}’s journal`
                  : "Clarity journal found"}
              </h3>
              <code className="path">{preview.vaultPath}</code>
              <dl>
                <div>
                  <dt>Transactions</dt>
                  <dd>{preview.transactions}</dd>
                </div>
                <div>
                  <dt>Accounts</dt>
                  <dd>{preview.accounts}</dd>
                </div>
                <div>
                  <dt>Balance snapshots</dt>
                  <dd>{preview.balances}</dd>
                </div>
                <div>
                  <dt>Categories</dt>
                  <dd>{preview.categories}</dd>
                </div>
                <div>
                  <dt>Saved views</dt>
                  <dd>{preview.savedViews}</dd>
                </div>
                <div>
                  <dt>Currency</dt>
                  <dd>{preview.currency}</dd>
                </div>
              </dl>
              {preview.olderFormat && (
                <p className="notice">
                  This is an older vault. Clarity will keep an upgrade backup
                  and add the files needed by this version.
                </p>
              )}
            </section>
          )}
          <p className="form-note">
            <ShieldCheck size={15} /> Close other Clarity instances and file
            editors before opening. Existing vault settings take priority over
            unfinished setup choices. Your OpenAI key is stored separately from
            the vault.
          </p>
        </div>
        <div className="dialog-actions">
          <button
            type="button"
            className="btn"
            disabled={working}
            onClick={close}
          >
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={working || picker.picking || !path.trim()}
          >
            {working
              ? "Checking…"
              : preview
                ? "Open this vault"
                : "Check folder"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

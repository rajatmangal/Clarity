"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  FolderOpen,
  HardDrive,
  Palette,
  ShieldCheck,
  UserRound,
  Wallet,
} from "lucide-react";
import { themes } from "../public/money-model.js";
import OpenVaultDialog from "./open-vault-dialog";
import useFolderPicker from "./use-folder-picker";
import { currencyCodes, currencyName } from "../public/currencies.js";

const steps = ["Your journal", "Your files", "Your style", "Ready to begin"];
export default function Onboarding({
  state,
  meta,
  api,
  onFinish,
  onCancel,
  onOpenVault,
}) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(state.displayName || "");
  const [currency, setCurrency] = useState(state.currency);
  const [theme, setTheme] = useState(state.theme);
  const [vaultPath, setVaultPath] = useState(meta.vaultPath || "");
  const [working, setWorking] = useState(false);
  const [existingOpen, setExistingOpen] = useState(false);
  const [error, setError] = useState("");
  const folderPicker = useFolderPicker(api, setVaultPath, setError);
  const heading = useRef(null);
  const locked = Boolean(state.transactions.length || state.balances.length);
  const server = meta.platform === "server";
  const chosenTheme = themes.find((t) => t.id === theme) || themes[0];
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    return () => {
      document.documentElement.dataset.theme = state.theme || "lavender";
    };
  }, [theme, state.theme]);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [step]);
  async function next(event) {
    event.preventDefault();
    folderPicker.cancel();
    setError("");
    if (step === 1 && !vaultPath.trim()) {
      setError("Choose where to keep your journal, or use the current folder.");
      return;
    }
    if (step < 3) {
      setStep(step + 1);
      return;
    }
    setWorking(true);
    try {
      await onFinish({ displayName: name.trim(), currency, theme }, vaultPath);
    } catch (e) {
      setError(e.message || "Setup could not be saved. Please try again.");
    } finally {
      setWorking(false);
    }
  }
  return (
    <main className="onboarding">
      <aside className="onboarding-story">
        <a
          href="#"
          className="onboarding-brand"
          onClick={(e) => e.preventDefault()}
        >
          <img src="/brand/clarity.svg" width="48" height="48" alt="" />
          Clarity<span>.</span>
        </a>
        <div>
          <span className="eyebrow">A LITTLE CLARITY, EVERY DAY</span>
          <h1>
            Your money.
            <br />
            Your space.
          </h1>
          <p>
            See your spending. Plan your saving. Start with a journal that feels
            like yours.
          </p>
        </div>
        <div className="onboarding-trust">
          <ShieldCheck size={24} />
          <div>
            <strong>No signup. You own your records.</strong>
            <p>
              {server
                ? "Your vault stays on the server you chose. Clarity has no hosted account or cloud vault."
                : "Your financial records live in files on this computer. Clarity does not automatically upload or sync them."}
            </p>
          </div>
        </div>
      </aside>
      <section className="onboarding-content" aria-label="Set up your journal">
        <ol className="onboarding-progress" aria-label="Setup progress">
          {steps.map((label, i) => (
            <li
              key={label}
              className={i === step ? "active" : i < step ? "complete" : ""}
              aria-current={i === step ? "step" : undefined}
            >
              <span>{i < step ? <Check size={15} /> : i + 1}</span>
              <small>{label}</small>
            </li>
          ))}
        </ol>
        <form onSubmit={next} className="onboarding-form" aria-busy={working}>
          <div className="onboarding-step">
            <span className="eyebrow">STEP {step + 1} OF 4</span>
            <h2 ref={heading} tabIndex={-1}>
              {
                [
                  "Let’s make this yours.",
                  "A home for your money journal.",
                  "Find your kind of calm.",
                  name.trim()
                    ? `You’re ready, ${name.trim()}.`
                    : "Your journal is ready.",
                ][step]
              }
            </h2>
            {step === 0 && (
              <>
                <p>
                  Just a few choices to get started. You can change these in
                  Settings later.
                </p>
                <label className="field">
                  <span>
                    What should we call you? <small>(optional)</small>
                  </span>
                  <input
                    autoComplete="given-name"
                    maxLength={80}
                    placeholder="Your name or nickname"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={working}
                  />
                  <small>
                    This personalizes your journal. It stays in Settings.md in
                    your vault.
                  </small>
                </label>
                <label className="field">
                  <span>Your currency</span>
                  <select
                    value={currency}
                    disabled={locked || working}
                    onChange={(e) => setCurrency(e.target.value)}
                  >
                    {currencyCodes.map((code) => (
                      <option key={code} value={code}>
                        {code} — {currencyName(code)}
                      </option>
                    ))}
                  </select>
                  <small>
                    {locked
                      ? "Your existing records use this currency. Currency stays locked while transactions or balances exist."
                      : "All accounts use one currency. Clarity does not convert amounts; choose before adding transactions or balances."}
                  </small>
                </label>
                <div className="onboarding-note">
                  <UserRound size={21} />
                  <p>
                    No account, email, or bank login needed. A nickname is
                    enough—or leave it blank.
                  </p>
                </div>
              </>
            )}
            {step === 1 && (
              <>
                <p>
                  A <strong>vault</strong> is simply a folder of readable
                  Markdown files. It holds your transactions, accounts, budgets,
                  balances, and preferences. Open it in Obsidian anytime.
                </p>
                <label className="field">
                  <span>
                    {server
                      ? "Vault folder on your server"
                      : "Vault folder on this computer"}
                  </span>
                  <input
                    required
                    value={vaultPath}
                    onChange={(e) => setVaultPath(e.target.value)}
                    disabled={working}
                    spellCheck={false}
                  />
                  <small>
                    {server
                      ? "This path belongs to the server, not the computer running this browser."
                      : "Keep the current location, or choose a new or empty folder. Missing folders are created when you finish."}
                  </small>
                </label>
                <div className="onboarding-note">
                  <FolderOpen size={21} />
                  <div>
                    <strong>Already have a Clarity vault?</strong>
                    <p>
                      After reinstalling, open your previous folder to keep its
                      records and saved preferences.
                    </p>
                    <button
                      type="button"
                      className="btn"
                      disabled={working}
                      onClick={() => setExistingOpen(true)}
                    >
                      Open existing vault
                    </button>
                  </div>
                </div>
                <div className="onboarding-folder-actions">
                  {meta.folderPickerAvailable !== false && (
                    <button
                      className="btn"
                      type="button"
                      disabled={working || folderPicker.picking}
                      onClick={folderPicker.pick}
                    >
                      <FolderOpen size={18} />
                      {folderPicker.picking
                        ? "Choosing folder…"
                        : "Choose folder…"}
                    </button>
                  )}
                  {folderPicker.picking && (
                    <button
                      type="button"
                      className="btn"
                      onClick={folderPicker.cancel}
                    >
                      Cancel folder picker
                    </button>
                  )}
                  {vaultPath !== meta.vaultPath && (
                    <button
                      className="btn"
                      type="button"
                      disabled={working}
                      onClick={() => setVaultPath(meta.vaultPath)}
                    >
                      Use current folder
                    </button>
                  )}
                </div>
                {vaultPath.trim() !== meta.vaultPath && (
                  <p className="notice">
                    When you finish, the current vault and its notes and backups
                    move to this new or empty folder. Close Obsidian and other
                    editors first. Existing files at the destination are never
                    overwritten.
                  </p>
                )}
                <div className="onboarding-file-list">
                  <div>
                    <HardDrive size={20} />
                    <span>
                      <strong>Readable files, always yours</strong>
                      <small>
                        Transactions.md · Accounts.md · Categories.md ·
                        Balances.md · Settings.md, plus your saved import
                        mappings, budgets, and notes.
                      </small>
                    </span>
                  </div>
                  <div>
                    <ShieldCheck size={20} />
                    <span>
                      <strong>Local recovery copies</strong>
                      <small>
                        The latest 30 table snapshots stay in .backups inside
                        your vault. Keep a separate backup too; these files are
                        plaintext.
                      </small>
                    </span>
                  </div>
                </div>
                <p className="form-note">
                  Clarity does not sync your files automatically. Choosing an
                  iCloud, OneDrive, or Dropbox folder—or hosting on a cloud
                  server—puts the files with that provider.
                </p>
              </>
            )}
            {step === 2 && (
              <>
                <p>
                  Choose a theme and see it here instantly. Your choice is saved
                  in Settings.md with the rest of your preferences.
                </p>
                <div className="theme-options onboarding-themes">
                  {themes.map((t) => (
                    <button
                      type="button"
                      key={t.id}
                      className={`theme-option ${theme === t.id ? "selected" : ""}`}
                      aria-pressed={theme === t.id}
                      onClick={() => setTheme(t.id)}
                    >
                      <span className="theme-swatches">
                        {t.colors.map((color) => (
                          <i key={color} style={{ background: color }} />
                        ))}
                      </span>
                      <strong>{t.name}</strong>
                      <small>{t.description}</small>
                      {theme === t.id && <Check size={16} />}
                    </button>
                  ))}
                </div>
                <div className="onboarding-note">
                  <Palette size={21} />
                  <p>
                    Make yourself comfortable. You can switch themes anytime in
                    Settings.
                  </p>
                </div>
              </>
            )}
            {step === 3 && (
              <>
                <p>
                  Here’s where we’ll start. Your existing records are kept as
                  they are.
                </p>
                <dl className="onboarding-review">
                  <div>
                    <dt>Journal name</dt>
                    <dd>
                      {name.trim()
                        ? `${name.trim()}’s journal`
                        : "My money journal"}
                    </dd>
                  </div>
                  <div>
                    <dt>Currency</dt>
                    <dd>
                      {currency} — {currencyName(currency)}
                    </dd>
                  </div>
                  <div>
                    <dt>Theme</dt>
                    <dd>{chosenTheme.name}</dd>
                  </div>
                  <div>
                    <dt>{server ? "Server vault" : "Local vault"}</dt>
                    <dd className="onboarding-path">{vaultPath}</dd>
                  </div>
                </dl>
                <div className="onboarding-note">
                  <Wallet size={22} />
                  <p>
                    <strong>Your next step:</strong> add an account, import a
                    CSV statement, and choose a few categories. Saved mappings
                    and merchant choices make the next import easier.
                  </p>
                </div>
                <p className="form-note">
                  <strong>AI is optional.</strong> You can connect your own
                  OpenAI key later in Settings. If you use it, selected
                  descriptions and category examples are sent to OpenAI. Amounts
                  and balances stay out of categorization requests. Everything
                  else works without AI.
                </p>
              </>
            )}
          </div>
          {error && (
            <div className="notice danger" role="alert">
              {error}
            </div>
          )}
          <div className="onboarding-actions">
            {step > 0 ? (
              <button
                type="button"
                className="btn"
                disabled={working}
                onClick={() => {
                  setStep(step - 1);
                  setError("");
                }}
              >
                <ChevronLeft size={17} />
                Back
              </button>
            ) : onCancel ? (
              <button type="button" className="btn" onClick={onCancel}>
                Return to Settings
              </button>
            ) : (
              <span className="form-note">About two minutes. No signup.</span>
            )}
            <button className="btn primary" disabled={working}>
              {working
                ? "Please wait…"
                : step === 3
                  ? "Open my journal"
                  : "Continue"}
              <ArrowRight size={17} />
            </button>
          </div>
          <p className="onboarding-footnote">
            {step === 3
              ? "Your choices are saved when you open your journal."
              : "Nothing moves until you finish setup."}
          </p>
        </form>
      </section>
      {existingOpen && (
        <OpenVaultDialog
          api={api}
          meta={meta}
          onOpened={onOpenVault}
          onClose={() => setExistingOpen(false)}
        />
      )}
    </main>
  );
}

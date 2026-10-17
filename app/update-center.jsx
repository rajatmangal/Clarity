"use client";
import { useEffect, useState } from "react";
import {
  Download,
  RefreshCw,
  ArrowUpRight,
  X,
  CircleCheck,
} from "lucide-react";
export default function UpdateCenter({ api, details, blocked }) {
  const [update, setUpdate] = useState(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [dismissed, setDismissed] = useState("");
  useEffect(() => {
    let active = true;
    const poll = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/updates");
        if (res.ok) {
          const result = await res.json();
          if (active) setUpdate(result);
        }
      } catch {
        /* Offline checks should never prevent using the journal. */
      }
    };
    void poll();
    const interval = setInterval(poll, 15000);
    document.addEventListener("visibilitychange", poll);
    return () => {
      active = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", poll);
    };
  }, []);
  async function action(action, value) {
    setWorking(true);
    setError("");
    try {
      setUpdate(await api("updates", { action, value }));
    } catch (e) {
      setError(e.message || "Could not complete the update action.");
    } finally {
      setWorking(false);
    }
  }
  if (!update) return null;
  const notice =
    ["available", "downloading", "ready", "installing"].includes(
      update.status,
    ) ||
    (update.status === "error" && Boolean(update.availableVersion));
  if (
    !details &&
    (!notice || dismissed === `${update.availableVersion}:${update.status}`)
  )
    return null;
  const inProgress =
    working ||
    ["checking", "downloading", "installing"].includes(update.status);
  const title =
    update.status === "available"
      ? `Clarity ${update.availableVersion} is available`
      : update.status === "downloading"
        ? `Downloading update · ${Math.round(update.progress)}%`
        : update.status === "ready"
          ? "Your update is ready"
          : update.status === "installing"
            ? "Restarting to install…"
            : update.status === "checking"
              ? "Checking for updates…"
              : update.status === "disabled"
                ? "Development build"
                : update.status === "error"
                  ? "Update check needs attention"
                  : update.checkedAt
                    ? "You’re up to date"
                    : "Keep Clarity up to date";
  return (
    <section
      className={`update-center ${details ? "panel update-details" : "update-banner"}`}
      aria-label="App updates"
    >
      <div className="update-heading">
        <Download size={20} aria-hidden="true" />
        <div>
          <h2>{details ? "App updates" : title}</h2>
          {details && (
            <p>Installed version {update.version} · Latest build channel</p>
          )}
        </div>
        {!details && update.status !== "installing" && (
          <button
            type="button"
            className="icon-button"
            aria-label="Dismiss update notification"
            onClick={() =>
              setDismissed(`${update.availableVersion}:${update.status}`)
            }
          >
            <X size={17} />
          </button>
        )}
      </div>
      <div role="status" aria-live="polite">
        {details && <strong>{title}</strong>}
        {update.status === "available" && (
          <p>
            {update.canInstall
              ? "Download the update here, then restart when you’re ready. Your saved vault and preferences stay in place."
              : update.reason}
          </p>
        )}
        {update.status === "ready" && (
          <p>
            Finish editing before restarting. Your saved vault, preferences, and
            API key stay in place.
          </p>
        )}
        {update.status === "disabled" && <p>{update.reason}</p>}
        {update.status === "downloading" && (
          <progress
            max="100"
            value={update.progress}
            aria-label="Update download progress"
          />
        )}
      </div>
      {(error || update.error) && (
        <p className="notice danger" role="alert">
          {error || update.error}
        </p>
      )}
      <div className="update-actions">
        {update.status === "available" &&
          (update.canInstall ? (
            <button
              className="btn primary"
              disabled={inProgress || blocked}
              onClick={() => action("download")}
            >
              <Download size={16} />
              Download update
            </button>
          ) : (
            <button
              className="btn primary"
              disabled={working}
              onClick={() => action("open")}
            >
              <ArrowUpRight size={16} />
              Open latest download
            </button>
          ))}
        {update.status === "ready" && (
          <button
            className="btn primary"
            disabled={working || blocked}
            onClick={() => action("install")}
          >
            <RefreshCw size={16} />
            Restart and install
          </button>
        )}
        {(details || update.status === "error") && (
          <button
            className="btn"
            disabled={
              inProgress ||
              update.status === "disabled" ||
              update.status === "ready"
            }
            onClick={() => action("check")}
          >
            <RefreshCw size={16} />
            Check for updates
          </button>
        )}
        {update.status === "idle" && update.checkedAt && details && (
          <small>
            <CircleCheck size={14} />
            Last checked {new Date(update.checkedAt).toLocaleString()}
          </small>
        )}
      </div>
      {details && (
        <div className="update-preferences">
          <label>
            <input
              type="checkbox"
              checked={update.automatic}
              disabled={working || update.status === "installing"}
              onChange={(e) => action("automatic", e.target.checked)}
            />
            Check automatically
          </label>
          <p>
            Checks GitHub shortly after launch and every six hours while Clarity
            is open. These requests do not include your vault records, balances,
            or OpenAI key. Updates download only when you ask, and installation
            requires a restart.
          </p>
          {!update.canInstall && update.status !== "disabled" && (
            <p>{update.reason}</p>
          )}
        </div>
      )}
    </section>
  );
}

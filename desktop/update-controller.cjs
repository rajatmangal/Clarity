// Update state is independent of Electron so transitions can be tested safely.
function createUpdateController({
  updater,
  version,
  enabled,
  canInstall,
  reason = "",
  automatic = true,
  saveAutomatic = async () => {},
  prepareInstall = () => {},
  now = () => new Date().toISOString(),
  schedule = setTimeout,
}) {
  let state = {
    status: enabled ? "idle" : "disabled",
    version,
    availableVersion: null,
    progress: 0,
    automatic,
    canInstall: enabled && canInstall,
    reason,
    error: "",
    checkedAt: null,
  };
  let checking = null;
  let downloading = false;
  const listeners = [];
  const getState = () => ({ ...state });
  const patch = (next) => {
    state = { ...state, ...next };
  };
  const on = (name, fn) => {
    updater.on(name, fn);
    listeners.push([name, fn]);
  };
  if (enabled) {
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = false;
    updater.allowPrerelease = true;
    updater.allowDowngrade = false;
    updater.logger = null;
    on("checking-for-update", () => patch({ status: "checking", error: "" }));
    on("update-available", (info) =>
      patch({
        status: "available",
        availableVersion: info.version,
        progress: 0,
        checkedAt: now(),
        error: "",
      }),
    );
    on("update-not-available", () =>
      patch({
        status: "idle",
        availableVersion: null,
        checkedAt: now(),
        error: "",
      }),
    );
    on("download-progress", (p) =>
      patch({
        status: "downloading",
        progress: Math.min(100, Math.max(0, Number(p.percent) || 0)),
      }),
    );
    on("update-downloaded", (info) => {
      downloading = false;
      patch({
        status: "ready",
        availableVersion: info.version,
        progress: 100,
        error: "",
      });
    });
    on("error", () => {
      downloading = false;
      patch({
        status: "error",
        error:
          "Could not complete the update. Check your connection and try again. Your records are safe.",
      });
    });
  }
  async function check() {
    if (
      !enabled ||
      downloading ||
      ["ready", "installing"].includes(state.status)
    )
      return getState();
    if (checking) {
      await checking;
      return getState();
    }
    patch({ status: "checking", error: "" });
    checking = Promise.resolve()
      .then(() => updater.checkForUpdates())
      .catch(() => {
        patch({
          status: "error",
          error:
            "Could not check for updates. Check your connection and try again.",
        });
      })
      .finally(() => {
        checking = null;
      });
    await checking;
    return getState();
  }
  function download() {
    if (!state.canInstall)
      throw Error(
        reason || "In-app installation is unavailable for this build.",
      );
    if (downloading || state.status === "ready") return getState();
    if (state.status !== "available")
      throw Error("Check for an available update first.");
    downloading = true;
    patch({ status: "downloading", progress: 0, error: "" });
    Promise.resolve()
      .then(() => updater.downloadUpdate())
      .catch(() => {
        downloading = false;
        patch({
          status: "error",
          error:
            "The update could not be downloaded or verified. Check again to retry.",
        });
      });
    return getState();
  }
  function install() {
    if (!state.canInstall || state.status !== "ready")
      throw Error("Download and verify an update before restarting.");
    patch({ status: "installing" });
    schedule(() => {
      try {
        prepareInstall();
        updater.quitAndInstall(false, true);
      } catch {
        patch({
          status: "error",
          error:
            "The installer could not start. Please reopen Clarity and try again.",
        });
      }
    }, 1000);
    return getState();
  }
  async function setAutomatic(value) {
    if (typeof value !== "boolean") throw Error("Invalid update preference.");
    await saveAutomatic(value);
    patch({ automatic: value });
    return getState();
  }
  return {
    getState,
    check,
    download,
    install,
    setAutomatic,
    dispose() {
      for (const [name, fn] of listeners) updater.removeListener(name, fn);
    },
  };
}
module.exports = { createUpdateController };

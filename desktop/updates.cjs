const { Notification } = require("electron");
const { autoUpdater } = require("electron-updater");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const fs = require("node:fs/promises");
const path = require("node:path");
const { createUpdateController } = require("./update-controller.cjs");
const RELEASE_PAGE =
  "https://github.com/rajatmangal/Clarity/releases/tag/latest";
async function hasMacIdentity(app) {
  try {
    const { stderr } = await promisify(execFile)(
      "/usr/bin/codesign",
      ["-dv", "--verbose=4", path.resolve(process.execPath, "../../..")],
      { timeout: 5000 },
    );
    return (
      /Authority=Developer ID Application:/.test(stderr) &&
      /TeamIdentifier=(?!not set)[A-Z0-9]+/.test(stderr)
    );
  } catch {
    return false;
  }
}
async function setupUpdates({ app, shell, prepareInstall, showWindow }) {
  const file = path.join(app.getPath("userData"), "update-settings.json");
  const saved = await fs
    .readFile(file, "utf8")
    .then(JSON.parse)
    .catch(() => ({ automatic: true }));
  const enabled =
    app.isPackaged && ["win32", "darwin"].includes(process.platform);
  const signed = process.platform !== "darwin" || (await hasMacIdentity(app));
  const reason = !app.isPackaged
    ? "Update installation is available in installed desktop builds."
    : !signed
      ? "This Mac build is unsigned. Updates are announced here; automatic installation requires a signed Mac release."
      : !enabled
        ? "Use your platform’s installer to update this build."
        : "";
  const controller = createUpdateController({
    updater: autoUpdater,
    version: app.getVersion(),
    enabled,
    canInstall: signed,
    reason,
    automatic: saved.automatic !== false,
    saveAutomatic: async (automatic) => {
      const temp = file + ".tmp";
      await fs.writeFile(temp, JSON.stringify({ automatic }) + "\n", {
        mode: 0o600,
      });
      await fs.rename(temp, file);
    },
    prepareInstall,
  });
  let lastNoticeVersion = "";
  const announce = (info) => {
    if (info.version === lastNoticeVersion || !Notification.isSupported())
      return;
    lastNoticeVersion = info.version;
    const notification = new Notification({
      title: "Clarity update available",
      body: `Version ${info.version} is ready to download. Open Clarity to review it.`,
    });
    notification.on("click", showWindow);
    notification.show();
  };
  if (enabled) autoUpdater.on("update-available", announce);
  const tick = () => {
    if (controller.getState().automatic) void controller.check();
  };
  let first, interval;
  return {
    ...controller,
    start() {
      if (enabled) {
        first = setTimeout(tick, 15000);
        first.unref();
        interval = setInterval(tick, 6 * 60 * 60 * 1000);
        interval.unref();
      }
    },
    stop() {
      clearTimeout(first);
      clearInterval(interval);
      controller.dispose();
      autoUpdater.removeListener("update-available", announce);
    },
    async openDownloads() {
      await shell.openExternal(RELEASE_PAGE);
      return controller.getState();
    },
  };
}
module.exports = { setupUpdates };

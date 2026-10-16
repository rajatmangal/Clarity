const {
  app,
  BrowserWindow,
  dialog,
  Menu,
  utilityProcess,
  safeStorage,
  session,
} = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const net = require("node:net");
const { randomBytes } = require("node:crypto");
app.setName("Clarity");
if (process.env.CLARITY_TEST_DATA_DIR)
  app.setPath("userData", process.env.CLARITY_TEST_DATA_DIR);
let window,
  worker,
  origin,
  quitting = false;
const hasLock = app.requestSingleInstanceLock();
if (!hasLock) app.quit();
else {
  app.on("second-instance", () => {
    if (window) {
      if (window.isMinimized()) window.restore();
      window.show();
      window.focus();
    }
  });
  app.on("before-quit", () => {
    quitting = true;
    worker?.kill();
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
  app.on("activate", () => {
    if (!window && origin) createWindow();
    else window?.show();
  });
  app
    .whenReady()
    .then(start)
    .catch((error) => {
      dialog.showErrorBox("Clarity could not start", error.message);
      app.quit();
    });
}
async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}
function createWindow() {
  window = new BrowserWindow({
    title: "Clarity",
    width: 1380,
    height: 920,
    minWidth: 700,
    minHeight: 550,
    backgroundColor: "#101c2d",
    icon: path.join(__dirname, "../public/brand/clarity-512.png"),
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });
  window.once("ready-to-show", () => window.show());
  window.on("closed", () => {
    window = null;
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (new URL(url).origin !== origin) event.preventDefault();
  });
  window.webContents.on("will-attach-webview", (event) =>
    event.preventDefault(),
  );
  window.loadURL(origin);
}
async function start() {
  const dataDir = app.getPath("userData");
  await fs.mkdir(dataDir, { recursive: true });
  const config = path.join(dataDir, ".env");
  const hasConfig = await fs
    .stat(config)
    .then(() => true)
    .catch(() => false);
  if (!hasConfig && !process.env.CLARITY_TEST_DATA_DIR) {
    const result = await dialog.showMessageBox({
      type: "question",
      title: "Welcome to Clarity",
      message: "See your spending. Plan your saving.",
      detail:
        "Start a new money journal, or open your existing Markdown vault. Close any other Clarity/Folio server using that vault first.",
      buttons: ["Create a new vault", "Use an existing vault", "Cancel"],
      defaultId: 0,
      cancelId: 2,
    });
    if (result.response === 2) {
      app.quit();
      return;
    }
    let vault = path.join(dataDir, "vault");
    if (result.response === 1) {
      const selected = await dialog.showOpenDialog({
        title: "Choose your existing money vault",
        properties: ["openDirectory"],
      });
      if (selected.canceled) {
        app.quit();
        return;
      }
      vault = selected.filePaths[0];
    }
    await fs.writeFile(
      config,
      `VAULT_DIR=${JSON.stringify(vault).replace(/\$/g, "\\$")}\n`,
      { mode: 0o600 },
    );
  }
  const port = await freePort();
  origin = `http://127.0.0.1:${port}`;
  const secret = randomBytes(32).toString("hex");
  session.defaultSession.setPermissionRequestHandler((_wc, _p, callback) =>
    callback(false),
  );
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    if (new URL(details.url).origin === origin)
      details.requestHeaders["X-Clarity-Desktop"] = secret;
    callback({ requestHeaders: details.requestHeaders });
  });
  const runtime = app.isPackaged
    ? path.join(process.resourcesPath, "runtime")
    : path.join(__dirname, "../build-runtime");
  const env = {
    ...process.env,
    NODE_ENV: "production",
    HOSTNAME: "127.0.0.1",
    PORT: String(port),
    CLARITY_DESKTOP: "1",
    CLARITY_DESKTOP_SECRET: secret,
    CLARITY_CONFIG_DIR: dataDir,
    CLARITY_RUNTIME_DIR: runtime,
  };
  delete env.CLARITY_ORIGIN;
  delete env.CLARITY_PASSWORD;
  delete env.VAULT_DIR;
  delete env.OPENAI_API_KEY;
  worker = utilityProcess.fork(path.join(__dirname, "server.cjs"), [], {
    cwd: runtime,
    env,
    stdio: "pipe",
    serviceName: "Clarity local server",
  });
  worker.on("message", async (message) => {
    if (message?.type !== "clarity-request") return;
    try {
      let value;
      const keyFile = path.join(dataDir, "openai-key.enc");
      if (message.action === "get-key") {
        const encrypted = await fs.readFile(keyFile).catch((e) => {
          if (e.code === "ENOENT") return null;
          throw e;
        });
        if (encrypted && !safeStorage.isEncryptionAvailable())
          throw Error("OS key storage is unavailable.");
        value = encrypted ? safeStorage.decryptString(encrypted) : "";
      } else if (message.action === "save-key") {
        if (typeof message.value !== "string" || message.value.length > 500)
          throw Error("Invalid key.");
        if (!message.value) await fs.rm(keyFile, { force: true });
        else {
          if (!safeStorage.isEncryptionAvailable())
            throw Error("OS key storage is unavailable.");
          const tmp = keyFile + ".tmp";
          await fs.writeFile(tmp, safeStorage.encryptString(message.value), {
            mode: 0o600,
          });
          await fs.rename(tmp, keyFile);
        }
        value = true;
      } else if (message.action === "pick-folder") {
        const result = await dialog.showOpenDialog(window, {
          title: "Choose a new or empty folder for your vault",
          properties: ["openDirectory", "createDirectory"],
        });
        value = result.canceled ? null : result.filePaths[0];
      } else throw Error("Unsupported desktop action.");
      worker?.postMessage({ type: "clarity-response", id: message.id, value });
    } catch (error) {
      worker?.postMessage({
        type: "clarity-response",
        id: message.id,
        error: error.message,
      });
    }
  });
  let exited = false;
  worker.on("exit", () => {
    exited = true;
    if (!quitting) {
      dialog.showErrorBox(
        "Clarity stopped",
        "The local service stopped. Your Markdown records are preserved. Please reopen Clarity.",
      );
      app.quit();
    }
  });
  // Do not log API responses, descriptions, keys, or environment variables.
  worker.stdout?.on("data", () => {});
  worker.stderr?.on("data", () => {});
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    if (exited) throw Error("The local service could not start.");
    try {
      const res = await fetch(origin + "/api/state", {
        headers: { "X-Clarity-Desktop": secret },
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        createWindow();
        installMenu();
        return;
      }
      if (res.status >= 500) {
        const result = await res.json();
        throw Error(result.error || "Unable to open your vault.");
      }
    } catch (error) {
      if (!["TypeError", "TimeoutError", "AbortError"].includes(error.name))
        throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw Error("The local service did not become ready. Please reopen Clarity.");
}
function installMenu() {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      ...(process.platform === "darwin"
        ? [
            {
              label: "Clarity",
              submenu: [
                { role: "about" },
                { type: "separator" },
                { role: "hide" },
                { role: "hideOthers" },
                { role: "unhide" },
                { type: "separator" },
                { role: "quit" },
              ],
            },
          ]
        : []),
      {
        label: "File",
        submenu: [
          process.platform === "darwin" ? { role: "close" } : { role: "quit" },
        ],
      },
      {
        label: "Edit",
        submenu: [
          { role: "undo" },
          { role: "redo" },
          { type: "separator" },
          { role: "cut" },
          { role: "copy" },
          { role: "paste" },
          { role: "selectAll" },
        ],
      },
      {
        label: "View",
        submenu: [
          { role: "reload" },
          { role: "resetZoom" },
          { role: "zoomIn" },
          { role: "zoomOut" },
          { role: "togglefullscreen" },
        ],
      },
      { label: "Window", submenu: [{ role: "minimize" }, { role: "zoom" }] },
    ]),
  );
}

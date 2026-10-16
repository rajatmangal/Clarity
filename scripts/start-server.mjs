import path from "node:path";
import { spawn } from "node:child_process";
import { readLocalSettings } from "../lib/local-settings.mjs";
const configDir = path.resolve(process.env.CLARITY_CONFIG_DIR || process.cwd());
const settings = await readLocalSettings(configDir);
const env = {
  ...settings,
  ...process.env,
  NODE_ENV: "production",
  CLARITY_CONFIG_DIR: configDir,
};
const host = env.CLARITY_HOST || "127.0.0.1";
const port = env.PORT || "4310";
if (
  !["127.0.0.1", "localhost", "::1"].includes(host) &&
  (!env.CLARITY_PASSWORD || !env.CLARITY_ORIGIN)
)
  throw Error(
    "Network server mode requires CLARITY_PASSWORD and CLARITY_ORIGIN.",
  );
if (env.CLARITY_ORIGIN && !env.CLARITY_PASSWORD)
  throw Error("Set CLARITY_PASSWORD when configuring a server origin.");
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    host,
    "--port",
    port,
  ],
  { stdio: "inherit", env: { ...env, PORT: port } },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code || 0));

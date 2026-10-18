import path from "node:path";
import { spawn } from "node:child_process";
import { access, cp } from "node:fs/promises";
import { fileURLToPath } from "node:url";
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
const project = fileURLToPath(new URL("../", import.meta.url));
const runtime = path.join(project, ".next/standalone");
const server = path.join(runtime, "server.js");
await access(server).catch(() => {
  throw Error("Build Clarity first with npm run build, then start it again.");
});
// The standalone server needs the same public/static assets as a deployment.
await Promise.all([
  cp(path.join(project, "public"), path.join(runtime, "public"), {
    recursive: true,
  }),
  cp(path.join(project, ".next/static"), path.join(runtime, ".next/static"), {
    recursive: true,
  }),
]);
const child = spawn(process.execPath, [server], {
  stdio: "inherit",
  env: { ...env, HOSTNAME: host, PORT: port },
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));

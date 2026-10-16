import {
  readFile,
  writeFile,
  rename,
  mkdir,
  readdir,
  rm,
  cp,
  lstat,
  chmod,
  realpath,
  rmdir,
} from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export async function writeEnv(root, values) {
  const file = path.join(root, ".env");
  let raw = await readFile(file, "utf8").catch((e) => {
    if (e.code === "ENOENT") return "";
    throw e;
  });
  for (const [key, value] of Object.entries(values)) {
    if (
      !["OPENAI_API_KEY", "VAULT_DIR"].includes(key) ||
      /[\r\n\0]/.test(value)
    )
      throw Error("Invalid local setting");
    const line = `${key}=${JSON.stringify(value).replace(/\$/g, "\\$")}`;
    const pattern = new RegExp(`^(?:export\\s+)?${key}\\s*=.*$`, "gm");
    raw = raw.replace(pattern, "").trimEnd() + "\n" + line + "\n";
  }
  const temp = file + "." + randomUUID() + ".tmp";
  try {
    await writeFile(temp, raw, { mode: 0o600 });
    await rename(temp, file);
  } finally {
    await rm(temp, { force: true });
  }
}

export async function moveVault(store, destination, expected, root) {
  if (
    typeof destination !== "string" ||
    !path.isAbsolute(destination) ||
    /[\r\n\0]/.test(destination)
  )
    throw Error("Enter a full absolute folder path.");
  await mkdir(path.dirname(destination), { recursive: true });
  const target = path.join(
      await realpath(path.dirname(destination)),
      path.basename(destination),
    ),
    source = await realpath(store.dir);
  if (target === source) return { vaultPath: source, ...(await store.read()) };
  if (
    target.startsWith(source + path.sep) ||
    source.startsWith(target + path.sep)
  )
    throw Error("Choose a folder outside the current vault.");
  const current = await store.read();
  if (current.revision !== expected)
    throw Error("Your records changed. Reload before moving the vault.");
  const exists = await lstat(target).catch((e) => {
    if (e.code === "ENOENT") return null;
    throw e;
  });
  if (
    exists &&
    (!exists.isDirectory() ||
      exists.isSymbolicLink() ||
      (await readdir(target)).length)
  )
    throw Error(
      "Choose a new or empty folder. Existing files will not be overwritten.",
    );
  await mkdir(path.dirname(target), { recursive: true });
  if (exists) await rmdir(target);
  // Keep the original intact until the verified destination and configuration are committed.
  const staging = target + ".moving-" + randomUUID();
  let copied = false,
    committed = false;
  try {
    await cp(source, staging, {
      recursive: true,
      errorOnExist: true,
      force: false,
      preserveTimestamps: true,
    });
    async function verify(a, b) {
      const entries = await readdir(a, { withFileTypes: true });
      if (entries.length !== (await readdir(b)).length)
        throw Error(
          "Vault files changed during the move. Please close other editors and retry.",
        );
      for (const entry of entries) {
        const from = path.join(a, entry.name),
          to = path.join(b, entry.name);
        if (entry.isDirectory()) await verify(from, to);
        else if (
          entry.isFile() &&
          !(await readFile(from)).equals(await readFile(to))
        )
          throw Error("Vault copy verification failed.");
        else if (!entry.isFile())
          throw Error(
            "Vault contains a symbolic link or unsupported file. Move it manually first.",
          );
      }
    }
    await verify(source, staging);
    await rename(staging, target);
    copied = true;
    await writeEnv(root, { VAULT_DIR: target });
    committed = true;
    store.dir = target;
    process.env.VAULT_DIR = target;
    let cleanupWarning = "";
    try {
      await verify(source, target);
      await rm(source, { recursive: true });
    } catch {
      cleanupWarning = `Vault moved. An old recovery copy remains at ${source}.`;
    }
    return { vaultPath: target, cleanupWarning, ...(await store.read()) };
  } catch (e) {
    if (!committed) {
      await rm(staging, { recursive: true, force: true });
      if (copied) await rm(target, { recursive: true, force: true });
    }
    throw e;
  }
}

// Read only local connection settings, without exposing them to client bundles.
export async function readLocalSettings(root) {
  const { parseEnv } = await import("node:util");
  const raw = await readFile(path.join(root, ".env"), "utf8").catch((e) => {
    if (e.code === "ENOENT") return "";
    throw e;
  });
  const parsed = parseEnv(raw);
  for (const key of ["OPENAI_API_KEY", "VAULT_DIR"]) {
    const matches = [
      ...raw.matchAll(new RegExp(`^(?:export\\s+)?${key}\\s*=(.*)$`, "gm")),
    ];
    const value = matches.at(-1)?.[1];
    if (value?.startsWith('"')) {
      try {
        parsed[key] = JSON.parse(value.replace(/\\\$/g, "$"));
      } catch {}
    }
  }
  return parsed;
}

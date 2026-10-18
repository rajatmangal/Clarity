import { lstat, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

export const limits = {
  total: 64 * 1024 * 1024,
  file: 16 * 1024 * 1024,
  archive: 32 * 1024 * 1024,
  count: 1000,
};
const extensions = new Set([
  ".md",
  ".txt",
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".csv",
  ".tsv",
  ".canvas",
]);
export const hash = (value) => createHash("sha256").update(value).digest("hex");
export function safeVaultName(name) {
  if (
    typeof name !== "string" ||
    name.length > 240 ||
    name.includes("\\") ||
    name.includes(":")
  )
    return false;
  const parts = name.split("/");
  return (
    parts.every(
      (p) =>
        p &&
        !p.startsWith(".") &&
        !/[\x00-\x1f<>"|?*]/.test(p) &&
        !/[. ]$/.test(p) &&
        !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p),
    ) && extensions.has(path.extname(name).toLowerCase())
  );
}
export async function safePath(root, name, internal = false) {
  if (!(
    safeVaultName(name) ||
    (internal && [".pending-save.md", ".backups"].includes(name))
  ))
    throw Error("Unsafe or unsupported vault filename.");
  let current = root;
  for (const part of ["", ...name.split("/")]) {
    if (part) current = path.join(current, part);
    const info = await lstat(current).catch((e) => {
      if (e.code === "ENOENT") return null;
      throw e;
    });
    if (info?.isSymbolicLink())
      throw Error("Symbolic links are not supported in recovery files.");
  }
  return path.join(root, name);
}
export async function readValue(root, name, binary = false) {
  const file = await safePath(root, name);
  try {
    const data = await readFile(file);
    return binary
      ? { encoding: "base64", data: data.toString("base64") }
      : data.toString("utf8");
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
}
export const valueBuffer = (value) =>
  typeof value === "string"
    ? Buffer.from(value)
    : Buffer.from(value.data, "base64");
export function validateValue(value) {
  if (typeof value === "string") return Buffer.byteLength(value) <= limits.file;
  return (
    value &&
    value.encoding === "base64" &&
    typeof value.data === "string" &&
    value.data.length <= limits.file * 1.34 &&
    /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      value.data,
    ) &&
    Buffer.byteLength(value.data, "base64") <= limits.file
  );
}
export async function collectVault(root) {
  const files = Object.create(null),
    skipped = [],
    names = new Set();
  let total = 0;
  async function walk(dir, prefix = "") {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const name = prefix + entry.name;
      if (entry.name.startsWith(".")) continue;
      if (entry.isSymbolicLink()) {
        skipped.push(name + " (symbolic link)");
        continue;
      }
      if (entry.isDirectory()) {
        if (name.length > 220 || name.split("/").length > 16) {
          skipped.push(name + " (deep folder)");
          continue;
        }
        await walk(path.join(dir, entry.name), name + "/");
        continue;
      }
      if (!entry.isFile() || !safeVaultName(name)) {
        skipped.push(name + " (unsupported file)");
        continue;
      }
      const key = name.normalize("NFC").toLowerCase();
      if (names.has(key))
        throw Error(
          "Vault filenames collide on case-insensitive systems. Rename duplicate files before backing up.",
        );
      names.add(key);
      const file = await safePath(root, name);
      const info = await lstat(file);
      if (
        info.size > limits.file ||
        Object.keys(files).length >= limits.count ||
        total + info.size > limits.total
      )
        throw Error(
          "Vault exceeds backup limits (64 MB total, 16 MB per file, 1,000 files). Move large attachments outside the vault first.",
        );
      const data = await readFile(file);
      if (data.length > limits.file || total + data.length > limits.total)
        throw Error("Vault changed beyond backup size limits while reading.");
      total += data.length;
      files[name] = data;
    }
  }
  await safePath(root, "Money.md");
  await walk(root);
  return { files, skipped, total };
}
export function fileFingerprint(files) {
  return hash(
    JSON.stringify(
      Object.keys(files)
        .sort()
        .map((name) => [name, hash(files[name])]),
    ),
  );
}
export function manifestFor(files, options = {}) {
  return {
    format: "clarity-vault",
    version: 1,
    createdAt: new Date().toISOString(),
    kind: "manual",
    scope: "vault",
    label: "Named backup",
    ...options,
    files: Object.fromEntries(
      Object.entries(files).map(([name, data]) => [name, hash(data)]),
    ),
  };
}
export async function writeManifest(dir, metadata) {
  await writeFile(
    path.join(dir, ".backup.md"),
    "# Clarity backup\n\n```json\n" +
      JSON.stringify(metadata, null, 2) +
      "\n```\n",
    { mode: 0o600 },
  );
}
export async function writeFiles(root, files) {
  await mkdir(root, { recursive: true });
  for (const [name, data] of Object.entries(files)) {
    const file = await safePath(root, name);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, data, { mode: 0o600, flag: "wx" });
  }
}

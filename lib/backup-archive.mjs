import { zipSync, unzipSync } from "fflate";
import { limits, safeVaultName, hash, manifestFor } from "./vault-files.mjs";

export function exportArchive(files, options) {
  const metadata = manifestFor(files, options);
  const archive = Buffer.from(
    zipSync(
      {
        ...files,
        "clarity-backup.json": Buffer.from(JSON.stringify(metadata, null, 2)),
      },
      { level: 6 },
    ),
  );
  if (archive.length > limits.archive)
    throw Error(
      "Compressed backup exceeds 32 MB. Move large attachments outside the vault first.",
    );
  return archive;
}
export function importArchive(data) {
  if (
    !Buffer.isBuffer(data) ||
    data.length > limits.archive ||
    data.length < 22
  )
    throw Error("Choose a Clarity ZIP backup smaller than 32 MB.");
  // Inspect the central directory before decompression to reject links, encryption,
  // duplicate names and declared oversized payloads. Never extract paths to disk.
  let end = -1;
  for (let i = data.length - 22; i >= Math.max(0, data.length - 65557); i--)
    if (
      data.readUInt32LE(i) === 0x06054b50 &&
      i + 22 + data.readUInt16LE(i + 20) === data.length
    ) {
      end = i;
      break;
    }
  if (end < 0 || data.readUInt16LE(end + 4) || data.readUInt16LE(end + 6))
    throw Error("Unsupported ZIP structure.");
  const count = data.readUInt16LE(end + 10),
    names = new Set();
  if (count > limits.count + 1 || count !== data.readUInt16LE(end + 8))
    throw Error("Too many files in this backup.");
  let offset = data.readUInt32LE(end + 16),
    total = 0;
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || data.readUInt32LE(offset) !== 0x02014b50)
      throw Error("Invalid ZIP directory.");
    const flags = data.readUInt16LE(offset + 8),
      method = data.readUInt16LE(offset + 10),
      size = data.readUInt32LE(offset + 24),
      length = data.readUInt16LE(offset + 28);
    if (offset + 46 + length > end) throw Error("Invalid ZIP filename.");
    const name = data
      .subarray(offset + 46, offset + 46 + length)
      .toString("utf8");
    const key = name.normalize("NFC").toLowerCase();
    if (
      (!safeVaultName(name) && name !== "clarity-backup.json") ||
      names.has(key)
    )
      throw Error("Unsafe, unsupported, or duplicate ZIP filename.");
    if (
      flags & 1 ||
      ![0, 8].includes(method) ||
      ((data.readUInt32LE(offset + 38) >>> 16) & 0xf000) === 0xa000
    )
      throw Error("Encrypted files and symbolic links are not supported.");
    total += size;
    names.add(key);
    if (size > limits.file || total > limits.total)
      throw Error("Backup expands beyond the allowed size.");
    offset +=
      46 +
      length +
      data.readUInt16LE(offset + 30) +
      data.readUInt16LE(offset + 32);
  }
  if (
    offset !== end ||
    offset - data.readUInt32LE(end + 16) !== data.readUInt32LE(end + 12)
  )
    throw Error("Unsupported ZIP directory layout.");
  const unpacked = unzipSync(data, {
    filter: (file) => {
      if (file.originalSize > limits.file)
        throw Error("Oversized archive entry.");
      return true;
    },
  });
  let metadata;
  try {
    metadata = JSON.parse(
      Buffer.from(unpacked["clarity-backup.json"]).toString("utf8"),
    );
  } catch {
    throw Error(
      "This ZIP is not a Clarity vault backup (manifest missing or invalid).",
    );
  }
  if (
    metadata.format !== "clarity-vault" ||
    metadata.version !== 1 ||
    !["data", "vault"].includes(metadata.scope) ||
    !metadata.files ||
    typeof metadata.files !== "object" ||
    Array.isArray(metadata.files)
  )
    throw Error("Unsupported backup format or version.");
  const files = Object.create(null);
  if (Object.keys(metadata.files).length !== Object.keys(unpacked).length - 1)
    throw Error("Backup file list does not match its manifest.");
  for (const [name, digest] of Object.entries(metadata.files)) {
    if (
      !safeVaultName(name) ||
      !unpacked[name] ||
      typeof digest !== "string" ||
      hash(unpacked[name]) !== digest
    )
      throw Error(
        "Backup integrity check failed. Files are missing or changed.",
      );
    files[name] = Buffer.from(unpacked[name]);
  }
  return { files, metadata };
}

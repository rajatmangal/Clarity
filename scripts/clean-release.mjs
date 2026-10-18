import { readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export async function cleanRelease(directory, version) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(
    (error) => {
      if (error.code === "ENOENT") return [];
      throw error;
    },
  );
  const removed = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const match = entry.name.match(
      /^Clarity-(.+)-(?:mac|win|linux)-(?:arm64|x64|ia32)\.(?:dmg|zip|exe|AppImage|deb|rpm)(?:\.blockmap)?$/,
    );
    if (match && match[1] !== version) {
      await rm(path.join(directory, entry.name));
      removed.push(entry.name);
    }
  }
  // Do not leave update metadata pointing at installers that were removed.
  for (const entry of entries) {
    if (
      !entry.isFile() ||
      !/^(?:latest|main|beta|alpha)(?:-mac|-linux)?\.yml$/.test(entry.name)
    )
      continue;
    const metadata = await readFile(path.join(directory, entry.name), "utf8");
    const declaredVersion = metadata.match(/^version:\s*['"]?([^\s'"]+)/m)?.[1];
    if (declaredVersion && declaredVersion !== version) {
      await rm(path.join(directory, entry.name));
      removed.push(entry.name);
    }
  }
  return removed;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const { version } = JSON.parse(
    await readFile(path.join(root, "package.json"), "utf8"),
  );
  const removed = await cleanRelease(path.join(root, "release"), version);
  console.log(
    `Removed ${removed.length} outdated release files; keeping version ${version}.`,
  );
}

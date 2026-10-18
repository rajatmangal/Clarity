import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readdir, rm, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { cleanRelease } from "../scripts/clean-release.mjs";

test("release cleanup removes old installers and metadata, preserving current files and other data", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "clarity-release-"));
  try {
    for (const name of [
      "Clarity-1.0.0-mac-arm64.dmg",
      "Clarity-1.0.0-mac-arm64.dmg.blockmap",
      "Clarity-1.2.1-mac-arm64.dmg",
      "notes.md",
    ]) {
      await writeFile(path.join(dir, name), "fixture");
    }
    await writeFile(path.join(dir, "latest.yml"), "version: 1.0.0\n");
    await writeFile(path.join(dir, "latest-mac.yml"), "version: 1.2.1\n");
    await mkdir(path.join(dir, "mac-arm64"));
    assert.equal((await cleanRelease(dir, "1.2.1")).length, 3);
    assert.deepEqual((await readdir(dir)).sort(), [
      "Clarity-1.2.1-mac-arm64.dmg",
      "latest-mac.yml",
      "mac-arm64",
      "notes.md",
    ]);
    assert.deepEqual(await cleanRelease(dir, "1.2.1"), []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

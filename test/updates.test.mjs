import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createRequire } from "node:module";
import { buildVersion } from "../scripts/ci-build-version.mjs";
const require = createRequire(import.meta.url);
const { createUpdateController } = require("../desktop/update-controller.cjs");
const semver = createRequire(require.resolve("electron-updater"))("semver");
function fixture(options = {}) {
  const updater = new EventEmitter();
  let checks = 0,
    downloads = 0,
    installs = 0,
    prepared = 0;
  let scheduled;
  updater.checkForUpdates = async () => {
    checks++;
    updater.emit("update-available", { version: "1.2.1-main.42.1" });
  };
  updater.downloadUpdate = async () => {
    downloads++;
    updater.emit("download-progress", { percent: 43 });
  };
  updater.quitAndInstall = () => {
    installs++;
  };
  const controller = createUpdateController({
    updater,
    version: "1.2.0",
    enabled: true,
    canInstall: true,
    prepareInstall: () => {
      prepared++;
    },
    schedule: (fn) => {
      scheduled = fn;
    },
    ...options,
  });
  return {
    updater,
    controller,
    counts: () => ({ checks, downloads, installs, prepared }),
    runScheduled: () => scheduled?.(),
  };
}

test("updates require explicit download and install; verified completion gates restart", async () => {
  const f = fixture();
  assert.equal(f.updater.autoDownload, false);
  assert.equal(f.updater.autoInstallOnAppQuit, false);
  assert.equal(f.updater.allowDowngrade, false);
  assert.throws(() => f.controller.install(), /verify/);
  await f.controller.check();
  assert.equal(f.controller.getState().status, "available");
  assert.equal(f.counts().downloads, 0);
  f.controller.download();
  await Promise.resolve();
  assert.equal(f.controller.getState().progress, 43);
  f.controller.download();
  assert.equal(f.counts().downloads, 1);
  assert.throws(() => f.controller.install(), /verify/);
  f.updater.emit("update-downloaded", { version: "1.2.1-main.42.1" });
  assert.equal(f.controller.getState().status, "ready");
  await f.controller.check();
  assert.equal(f.counts().checks, 1);
  f.controller.install();
  assert.equal(f.counts().installs, 0);
  f.runScheduled();
  assert.deepEqual(f.counts(), {
    checks: 1,
    downloads: 1,
    installs: 1,
    prepared: 1,
  });
});

test("unsigned Mac builds can detect updates but cannot download or install them", async () => {
  const f = fixture({ canInstall: false, reason: "Mac signing required" });
  await f.controller.check();
  assert.equal(f.controller.getState().availableVersion, "1.2.1-main.42.1");
  assert.throws(() => f.controller.download(), /signing required/);
  assert.throws(() => f.controller.install(), /verify/);
  assert.equal(f.counts().downloads, 0);
});

test("concurrent checks share one request and return full state; network failure can recover", async () => {
  const f = fixture();
  let finish;
  f.updater.checkForUpdates = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  const one = f.controller.check(),
    two = f.controller.check();
  await Promise.resolve();
  f.updater.emit("update-not-available");
  finish();
  for (const state of await Promise.all([one, two]))
    assert.equal(state.status, "idle");
  f.updater.checkForUpdates = async () => {
    throw Error("offline");
  };
  await f.controller.check();
  assert.equal(f.controller.getState().status, "error");
  f.updater.checkForUpdates = async () =>
    f.updater.emit("update-not-available");
  await f.controller.check();
  assert.equal(f.controller.getState().status, "idle");
});

test("development builds do not contact the feed and preferences persist before changing", async () => {
  const disabled = fixture({ enabled: false });
  await disabled.controller.check();
  assert.equal(disabled.counts().checks, 0);
  assert.equal(disabled.controller.getState().status, "disabled");
  let stored;
  const f = fixture({
    saveAutomatic: async (v) => {
      stored = v;
    },
  });
  await f.controller.setAutomatic(false);
  assert.equal(stored, false);
  assert.equal(f.controller.getState().automatic, false);
  await assert.rejects(() => f.controller.setAutomatic("false"), /Invalid/);
  const failed = fixture({
    saveAutomatic: async () => {
      throw Error("disk full");
    },
  });
  await assert.rejects(
    () => failed.controller.setAutomatic(false),
    /disk full/,
  );
  assert.equal(failed.controller.getState().automatic, true);
});

test("download verification errors leave installation blocked and allow a fresh check", async () => {
  const f = fixture();
  await f.controller.check();
  f.updater.downloadUpdate = async () => {
    throw Error("invalid checksum");
  };
  f.controller.download();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.controller.getState().status, "error");
  assert.throws(() => f.controller.install(), /verify/);
  await f.controller.check();
  assert.equal(f.controller.getState().status, "available");
});

test("main build versions increase across runs, retries, and base releases", () => {
  const v = buildVersion("1.2.0", "9", "1");
  assert.equal(v, "1.2.1-main.9.1");
  assert.ok(semver.gt(v, "1.2.0"));
  assert.ok(semver.gt(buildVersion("1.2.0", "10", "1"), v));
  assert.ok(semver.gt(buildVersion("1.2.0", "9", "2"), v));
  assert.ok(semver.gt(buildVersion("1.3.0", "11", "1"), v));
  assert.throws(() => buildVersion("bad", "1", "1"));
  assert.throws(() => buildVersion("1.2.0", undefined, "1"));
});

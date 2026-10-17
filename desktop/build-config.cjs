const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const base = require("../package.json").build;
const hasIdentity = Boolean(
  process.env.CSC_LINK ||
  process.env.CSC_NAME ||
  (base.mac.identity && base.mac.identity !== "-"),
);
module.exports = {
  ...base,
  mac: {
    ...base.mac,
    // Seal every app and helper even before a Developer ID certificate is available.
    identity: hasIdentity ? base.mac.identity : "-",
    notarize: hasIdentity && Boolean(base.mac.notarize),
  },
  async afterSign(context) {
    if (context.electronPlatformName !== "darwin") return;
    const app = path.join(
      context.appOutDir,
      `${context.packager.appInfo.productFilename}.app`,
    );
    await promisify(execFile)("/usr/bin/codesign", [
      "--verify",
      "--deep",
      "--strict",
      "--verbose=2",
      app,
    ]);
    console.log("Verified complete Mac application signature.");
  },
};

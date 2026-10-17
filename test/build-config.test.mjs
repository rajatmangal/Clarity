import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

function readConfig(signing) {
  return JSON.parse(execFileSync(process.execPath, ["-e", `
    const config = require('./desktop/build-config.cjs');
    console.log(JSON.stringify({
      link: process.env.CSC_LINK,
      installerLink: process.env.CSC_INSTALLER_LINK,
      windowsLink: process.env.WIN_CSC_LINK,
      identity: config.mac.identity,
      notarize: config.mac.notarize,
    }));
  `], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, CSC_NAME: "", ...signing },
    encoding: "utf8",
  }));
}

test("empty GitHub signing secrets do not become certificate paths", () => {
  assert.deepEqual(readConfig({
    CSC_LINK: "", CSC_INSTALLER_LINK: "  ", WIN_CSC_LINK: "",
  }), { identity: "-", notarize: false });
});

test("configured signing certificate links remain available to the builder", () => {
  const config = readConfig({
    CSC_LINK: "/test/developer.p12",
    CSC_INSTALLER_LINK: "/test/installer.p12",
    WIN_CSC_LINK: "/test/windows.pfx",
  });
  assert.equal(config.link, "/test/developer.p12");
  assert.equal(config.installerLink, "/test/installer.p12");
  assert.equal(config.windowsLink, "/test/windows.pfx");
  assert.equal(config.identity, undefined);
});

import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, cp } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import os from "node:os";
const port = await new Promise((resolve) => {
  const s = createServer();
  s.listen(0, "127.0.0.1", () => {
    const p = s.address().port;
    s.close(() => resolve(p));
  });
});
const root = await mkdtemp(path.join(os.tmpdir(), "clarity-http-"));
const runtime = path.join(root, "runtime");
await cp(process.env.CLARITY_TEST_RUNTIME || "build-runtime", runtime, {
  recursive: true,
});
const origin = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, [path.join(runtime, "server.js")], {
  env: {
    ...process.env,
    NODE_ENV: "production",
    HOSTNAME: "127.0.0.1",
    PORT: String(port),
    CLARITY_CONFIG_DIR: root,
    VAULT_DIR: path.join(root, "vault"),
    OPENAI_API_KEY: "",
    CLARITY_PASSWORD: "integration-password",
    CLARITY_ORIGIN: origin,
    CLARITY_DESKTOP: "0",
    CLARITY_DESKTOP_SECRET: "",
  },
  stdio: "ignore",
});
const auth =
  "Basic " + Buffer.from("clarity:integration-password").toString("base64");
test("packaged server protects data and accepts authorized read/write requests", async () => {
  try {
    let ready = false;
    for (let i = 0; i < 150; i++) {
      try {
        const r = await fetch(origin);
        if (r.status === 401) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(ready, true, "server started");
    assert.equal((await fetch(origin + "/api/state")).status, 401);
    const initial = await fetch(origin + "/api/state", {
      headers: { authorization: auth },
    });
    assert.equal(initial.status, 200);
    const data = await initial.json();
    assert.equal(data.platform, "server");
    assert.equal(data.folderPickerAvailable, false);
    assert.equal(data.state.transactions.length, 0);
    const headers = {
      authorization: auth,
      "Content-Type": "application/json",
      "X-Clarity-Token": data.token,
      Origin: origin,
    };
    assert.equal(
      (
        await fetch(origin + "/api/state", {
          method: "PUT",
          headers: { ...headers, Origin: "https://evil.example" },
          body: JSON.stringify({ state: data.state, revision: data.revision }),
        })
      ).status,
      403,
    );
    const saved = await fetch(origin + "/api/state", {
      method: "PUT",
      headers,
      body: JSON.stringify({
        state: { ...data.state, displayName: "Integration test" },
        revision: data.revision,
      }),
    });
    assert.equal(saved.status, 200);
    assert.equal((await saved.json()).state.displayName, "Integration test");
    const picked = await fetch(origin + "/api/vault/pick", {
      method: "POST",
      headers,
      body: "{}",
    });
    assert.notEqual(picked.status, 200);
    assert.match((await picked.json()).error, /server mode/);
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      const stopped = new Promise((resolve) => child.once("exit", resolve));
      child.kill();
      await stopped;
    }
    await rm(root, { recursive: true, force: true });
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { authorized, allowedOrigins } from "../lib/access.mjs";
import { lockVault } from "../lib/vault-lock.mjs";
test("server authentication requires the configured username and password", () => {
  const env = { CLARITY_PASSWORD: "test-pass" };
  assert.equal(authorized(new Headers(), env), false);
  assert.equal(
    authorized(
      new Headers({
        authorization:
          "Basic " + Buffer.from("clarity:test-pass").toString("base64"),
      }),
      env,
    ),
    true,
  );
  assert.equal(
    authorized(
      new Headers({
        authorization:
          "Basic " + Buffer.from("clarity:wrong").toString("base64"),
      }),
      env,
    ),
    false,
  );
  assert.equal(
    authorized(
      new Headers({
        authorization:
          "Basic " + Buffer.from("other:test-pass").toString("base64"),
      }),
      env,
    ),
    false,
  );
});
test("desktop session secret isolates desktop from other local clients", () => {
  assert.equal(
    authorized(new Headers(), { CLARITY_DESKTOP_SECRET: "secret" }),
    false,
  );
  assert.equal(
    authorized(new Headers({ "x-clarity-desktop": "secret" }), {
      CLARITY_DESKTOP_SECRET: "secret",
    }),
    true,
  );
  assert.deepEqual(allowedOrigins({ PORT: "7654" }), [
    "http://localhost:7654",
    "http://127.0.0.1:7654",
  ]);
  assert.deepEqual(
    allowedOrigins({ CLARITY_ORIGIN: "https://money.example.com" }),
    ["https://money.example.com"],
  );
});
test("vault locking prevents two app instances from sharing an active vault", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "clarity-lock-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = { dir: root };
  const release = await lockVault(store);
  t.after(release);
  await assert.rejects(lockVault(store), /already open/);
  release();
  const release2 = await lockVault(store);
  release2();
});

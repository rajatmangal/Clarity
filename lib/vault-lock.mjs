import { open, readFile, unlink, mkdir } from "node:fs/promises";
import { readFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
export async function lockVault(store) {
  await mkdir(store.dir, { recursive: true });
  const owner = { pid: process.pid, id: randomUUID() };
  const file = path.join(store.dir, ".clarity.lock");
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const handle = await open(file, "wx", 0o600);
      try {
        await handle.writeFile(JSON.stringify(owner));
      } finally {
        await handle.close();
      }
      const release = () => {
        const current = path.join(store.dir, ".clarity.lock");
        try {
          if (JSON.parse(readFileSync(current, "utf8")).id === owner.id)
            unlinkSync(current);
        } catch {}
      };
      process.once("exit", release);
      return release;
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
      let old;
      try {
        old = JSON.parse(await readFile(file, "utf8"));
      } catch {
        throw Error(
          "Vault lock cannot be read. Close other Clarity instances and check .clarity.lock.",
        );
      }
      let active = true;
      try {
        process.kill(old.pid, 0);
      } catch (error) {
        if (error.code === "ESRCH") active = false;
      }
      if (active)
        throw Error(
          "This vault is already open in another Clarity instance. Close it before continuing.",
        );
      await unlink(file);
    }
  }
  throw Error("Could not lock the vault. Please retry.");
}

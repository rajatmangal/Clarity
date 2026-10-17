import { cp, mkdir, rm, readdir } from "node:fs/promises";
import path from "node:path";
const dest = path.resolve("build-runtime");
await rm(dest, { recursive: true, force: true });
await mkdir(dest, { recursive: true });
await cp(".next/standalone", dest, {
  recursive: true,
  dereference: true,
  filter: (src) =>
    !path.basename(src).startsWith(".env") &&
    !["vault", ".git", "release", "artifacts", "build-runtime"].includes(
      path.basename(src),
    ),
});
await cp(".next/static", path.join(dest, ".next/static"), { recursive: true });
await cp("public", path.join(dest, "public"), { recursive: true });
// Fail packaging rather than silently ship local credentials or a user's vault.
async function inspect(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (
      entry.name.startsWith(".env") ||
      entry.name === "Transactions.md" ||
      entry.name === "Balances.md"
    )
      throw Error(`Private data found in runtime: ${entry.name}`);
    if (entry.isSymbolicLink())
      throw Error(`Unresolved dependency link in runtime: ${entry.name}`);
    if (entry.isDirectory()) await inspect(path.join(dir, entry.name));
  }
}
await inspect(dest);
console.log("Desktop runtime prepared without credentials or vault records.");

import { pathToFileURL } from "node:url";
import { readFile, writeFile } from "node:fs/promises";
export function buildVersion(base, run, attempt) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(base);
  if (!match || !/^\d+$/.test(String(run)) || !/^\d+$/.test(String(attempt)))
    throw Error("Invalid build version inputs");
  // Higher than the package's base version; every run and retry is distinguishable.
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}-main.${Number(run)}.${Number(attempt)}`;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const file = "package.json";
  const pkg = JSON.parse(await readFile(file, "utf8"));
  if (process.env.GITHUB_REF === "refs/heads/main") {
    pkg.version = buildVersion(
      pkg.version,
      process.env.GITHUB_RUN_NUMBER,
      process.env.GITHUB_RUN_ATTEMPT,
    );
  }
  // Signing credentials are supplied by repository secrets, never bundled.
  pkg.build.mac.notarize = Boolean(
    process.env.APPLE_ID &&
    process.env.APPLE_APP_SPECIFIC_PASSWORD &&
    process.env.APPLE_TEAM_ID,
  );
  await writeFile(file, JSON.stringify(pkg, null, 2) + "\n");
  console.log(`Desktop build version: ${pkg.version}`);
}

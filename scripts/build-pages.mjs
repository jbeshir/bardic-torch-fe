import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/**
 * Pick the Vite mode for a Cloudflare Pages Git build. Production unless the
 * branch is known and is not `main`, so a missing variable fails safe.
 * @param {Readonly<Record<string, string | undefined>>} env
 */
export function selectBuildMode(env) {
  const branch = env.CF_PAGES_BRANCH;
  return branch === undefined || branch === "" || branch === "main"
    ? "production"
    : "preview";
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const mode = selectBuildMode(process.env);
  console.log(`Building in ${mode} mode`);
  const result = spawnSync("npx", ["remix", "vite:build", "--mode", mode], {
    stdio: "inherit",
  });
  process.exit(result.status ?? 1);
}

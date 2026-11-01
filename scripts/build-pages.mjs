import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/**
 * The only branches Cloudflare Pages builds (docs/DEPLOY.md §2, Branch
 * control): `main` is production, `preview` the one preview deployment.
 */
const MODE_BY_BRANCH = new Map([
  ["main", "production"],
  ["preview", "preview"],
]);

/**
 * Pick the Vite mode for a Cloudflare Pages Git build: production for `main`
 * and when the branch is unknown (a missing variable fails safe), preview
 * for `preview`. Any other branch is refused: a preview build runs with the
 * Preview environment's secrets, so only the `preview` branch gets one.
 * @param {Readonly<Record<string, string | undefined>>} env
 * @returns {"production" | "preview"}
 */
export function selectBuildMode(env) {
  const branch = env.CF_PAGES_BRANCH;
  if (branch === undefined || branch === "") return "production";
  const mode = MODE_BY_BRANCH.get(branch);
  if (mode === undefined) {
    throw new Error(
      `Branch "${branch}" is not deployed: Pages builds only main (production) and preview. See docs/DEPLOY.md §2, Branch control.`
    );
  }
  return mode;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const mode = selectBuildMode(process.env);
    console.log(`Building in ${mode} mode`);
    const result = spawnSync("npx", ["remix", "vite:build", "--mode", mode], {
      stdio: "inherit",
    });
    process.exit(result.status ?? 1);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

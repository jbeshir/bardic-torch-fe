import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * `npm run dev`: `react-router dev` in the development build mode
 * (BT_BUILD_MODE, app/routes.ts: the styleguide is there). Extra arguments
 * go to react-router.
 */
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const child = spawn(
  path.join(ROOT, "node_modules/.bin/react-router"),
  ["dev", ...process.argv.slice(2)],
  {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, BT_BUILD_MODE: "development" },
  }
);
child.on("exit", code => {
  process.exitCode = code ?? 1;
});

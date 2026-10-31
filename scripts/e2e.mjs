import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * `npm run test:e2e [-- <playwright args>]`: the prod phase, then the stub
 * phase (see playwright.config.ts). They run one after the other because
 * both builds write build/ and functions/ serves whichever is there. Both
 * phases always run; the exit code is non-zero if either failed.
 *
 * A full run starts from an empty e2e/screenshots so the teardown can check
 * the screenshot set; any extra arguments make it a filtered run, which
 * keeps existing screenshots and skips that check.
 */

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PHASES = ["prod", "stub"];
const args = process.argv.slice(2);
const filtered = args.length > 0;

if (!filtered) {
  rmSync(path.join(ROOT, "e2e/screenshots"), { recursive: true, force: true });
}

const failed = PHASES.filter(phase => {
  console.log(`\n== e2e ${phase} phase`);
  const result = spawnSync(
    path.join(ROOT, "node_modules/.bin/playwright"),
    ["test", "--pass-with-no-tests", ...args],
    {
      cwd: ROOT,
      stdio: "inherit",
      env: {
        ...process.env,
        E2E_PHASE: phase,
        ...(filtered ? { E2E_PARTIAL: "1" } : {}),
        WRANGLER_SEND_METRICS: "false",
        CI: "1",
      },
    }
  );
  return result.status !== 0;
});

if (failed.length > 0) {
  console.error(`\ne2e failed in: ${failed.join(", ")}`);
  process.exitCode = 1;
}

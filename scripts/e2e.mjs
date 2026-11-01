import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
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
 *
 * Tests get one retry (playwright.config.ts). Every test that only passed
 * on its retry is listed after each phase and again at the very end, from
 * the phase's JSON report, and each is also printed as a GitHub Actions
 * `::warning` line, an annotation on the CI run (and a plain line in any
 * other log), so a flake is never hidden in a green run. A phase that
 * leaves no JSON report counts as failed: its flakes can't be listed.
 */

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PHASES = ["prod", "stub"];
const args = process.argv.slice(2);
const filtered = args.length > 0;

const reportPath = phase =>
  path.join(ROOT, "playwright-report", `${phase}.json`);

/**
 * `[project] file:line › title` of every flaky test in a JSON report, or
 * null when the phase wrote no report.
 */
function flakyTests(phase) {
  const file = reportPath(phase);
  if (!existsSync(file)) return null;
  const report = JSON.parse(readFileSync(file, "utf8"));
  const found = [];
  const walk = (suite, titles) => {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        if (test.status === "flaky") {
          found.push(
            `[${test.projectName}] ${spec.file}:${spec.line} › ${[...titles, spec.title].join(" › ")}`
          );
        }
      }
    }
    for (const child of suite.suites ?? []) {
      walk(
        child,
        child.title && !child.title.endsWith(".ts")
          ? [...titles, child.title]
          : titles
      );
    }
  };
  for (const suite of report.suites ?? []) walk(suite, []);
  return found;
}

function banner(lines) {
  const rule = "!".repeat(72);
  console.log(`\n${rule}\n${lines.join("\n")}\n${rule}`);
}

if (!filtered) {
  rmSync(path.join(ROOT, "e2e/screenshots"), { recursive: true, force: true });
}

const flaky = [];
const failed = PHASES.filter(phase => {
  console.log(`\n== e2e ${phase} phase`);
  rmSync(reportPath(phase), { force: true });
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
  const phaseFlaky = flakyTests(phase);
  if (phaseFlaky === null) {
    console.error(
      `\nThe ${phase} phase wrote no JSON report (${reportPath(phase)}).`
    );
    return true;
  }
  if (phaseFlaky.length > 0) {
    banner([
      `FLAKY in the ${phase} phase: ${phaseFlaky.length} test(s) passed only on their retry`,
      ...phaseFlaky.map(name => `  ${name}`),
    ]);
  }
  for (const name of phaseFlaky) {
    console.log(`::warning title=Flaky e2e test (${phase})::${name}`);
  }
  flaky.push(...phaseFlaky.map(name => `${phase}: ${name}`));
  return result.status !== 0;
});

if (flaky.length > 0) {
  banner([
    `FLAKY: ${flaky.length} test(s) passed only on their retry; look into each one`,
    ...flaky.map(name => `  ${name}`),
  ]);
} else {
  console.log("\nNo flaky tests: every test passed on its first try.");
}

if (failed.length > 0) {
  console.error(`\ne2e failed in: ${failed.join(", ")}`);
  process.exitCode = 1;
}

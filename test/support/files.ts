import { readdirSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();

/** Generated and gitignored: never part of a source scan. */
const SKIPPED_DIRECTORIES = ["e2e/screenshots"];

/**
 * Every file under `directory`, as a path relative to the repository root
 * (e.g. `app/root.tsx`), for the repo-wide scans in test/. Gitignored
 * output such as e2e screenshots is skipped.
 */
export function filesUnder(directory: string): string[] {
  return readdirSync(join(root, directory), {
    recursive: true,
    withFileTypes: true,
  })
    .filter(entry => entry.isFile())
    .map(entry => relative(root, join(entry.parentPath, entry.name)))
    .filter(
      path =>
        !SKIPPED_DIRECTORIES.some(skipped => path.startsWith(`${skipped}/`))
    );
}

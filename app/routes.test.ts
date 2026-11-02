import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("the route config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it.each([
    ["production", false],
    ["preview", true],
    ["e2e", true],
    ["development", true],
  ] as const)(
    "in %s mode includes the styleguide route: %s, and no test files",
    async (mode, included) => {
      // What Remix's Vite plugin sets up before it loads routes.ts.
      Object.assign(globalThis, {
        __remixAppDirectory: path.join(process.cwd(), "app"),
      });
      vi.stubEnv("MODE", mode);
      vi.resetModules();
      const { default: routes } = await import("./routes");
      const files = (await routes).map(route => route.file);
      expect(files.includes("routes/styleguide.tsx")).toBe(included);
      expect(files).toContain("routes/settings.tsx");
      expect(files.filter(file => /\.test\./.test(file))).toEqual([]);
    }
  );
});

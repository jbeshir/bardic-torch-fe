import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

/** The route config app/routes.ts gives for BT_BUILD_MODE `mode`. */
async function routeFiles(mode: string | undefined): Promise<string[]> {
  // What React Router's Vite plugin sets up before it loads routes.ts.
  Object.assign(globalThis, {
    __reactRouterAppDirectory: path.join(process.cwd(), "app"),
  });
  vi.stubEnv("BT_BUILD_MODE", mode);
  vi.resetModules();
  const { default: routes } = await import("./routes");
  return (await routes).map(route => route.file);
}

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
      const files = await routeFiles(mode);
      expect(files.includes("routes/styleguide.tsx")).toBe(included);
      expect(files).toContain("routes/settings.tsx");
      expect(files.filter(file => /\.test\./.test(file))).toEqual([]);
    }
  );

  it("without a build mode leaves the styleguide out (a bare build is production)", async () => {
    const files = await routeFiles(undefined);
    expect(files).not.toContain("routes/styleguide.tsx");
    expect(files).toContain("routes/settings.tsx");
  });

  it("refuses an unknown build mode, whatever NODE_ENV says", async () => {
    vi.stubEnv("NODE_ENV", "development");
    await expect(routeFiles("staging")).rejects.toThrow(
      'Unknown BT_BUILD_MODE "staging"'
    );
  });
});

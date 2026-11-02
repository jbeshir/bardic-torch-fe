/**
 * What `virtual:react-router/server-build` resolves to under vitest
 * (vitest.config.ts), where React Router's Vite plugin doesn't run. A test
 * of the Worker entry mocks it with a test build; anything that imports it
 * unmocked fails here, instead of serving nothing.
 */
throw new Error(
  "virtual:react-router/server-build has no build under vitest: vi.mock it"
);

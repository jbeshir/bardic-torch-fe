/** Compile-time flag set by Vite `define`; true only in `e2e` and `development` builds. */
declare const __STUB_AUTH__: boolean;

/** Compile-time flag set by Vite `define`; true only in `production` builds. */
declare const __INDEXABLE__: boolean;

/**
 * Compile-time constant set by Vite `define`: under `react-router dev`, the
 * app's variables set in the process environment (vite.config.ts), which
 * the Worker lays over its bindings; `{}` in every build.
 */
declare const __DEV_ENV_OVERRIDES__: Readonly<Record<string, string>>;

import { fileURLToPath } from "node:url";
import { includeIgnoreFile } from "@eslint/compat";
import js from "@eslint/js";
import eslintReact from "@eslint-react/eslint-plugin";
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import betterTailwindcss from "eslint-plugin-better-tailwindcss";
import {
  createNodeResolver,
  flatConfigs as importX,
} from "eslint-plugin-import-x";
import jsxA11y from "eslint-plugin-jsx-a11y-x";
import reactHooks from "eslint-plugin-react-hooks";
import { defineConfig } from "eslint/config";
import globals from "globals";
import { configs as tseslintConfigs } from "typescript-eslint";
import {
  componentClasses,
  RESTRICTED_CLASSES,
} from "./scripts/tailwind-classes.mjs";

/**
 * Unused exports, files and dependencies are knip's job (`check:unused`,
 * knip.json): ESLint 10 has no working `no-unused-modules` rule.
 */

/** Every rule of a shared config at error: lint runs with --max-warnings 0. */
function atError(rules: Readonly<Record<string, unknown>> = {}) {
  return Object.fromEntries(
    Object.entries(rules).map(([name, entry]) => {
      if (entry === "warn") return [name, "error"];
      if (Array.isArray(entry) && entry[0] === "warn") {
        return [name, ["error", ...entry.slice(1)]];
      }
      return [name, entry];
    })
  );
}

const resolver = {
  "import-x/internal-regex": "^~/",
  "import-x/resolver-next": [
    createTypeScriptImportResolver({ alwaysTryTypes: true }),
    createNodeResolver({ extensions: [".ts", ".tsx", ".js", ".mjs"] }),
  ],
};

// The three import rules the shared configs set to warn fail lint like the
// rest.
const importWarningsAsErrors = {
  "import-x/no-named-as-default": "error",
  "import-x/no-named-as-default-member": "error",
  "import-x/no-duplicates": "error",
} as const;

const react = eslintReact.configs["recommended-typescript"];

export default defineConfig(
  includeIgnoreFile(fileURLToPath(new URL(".gitignore", import.meta.url))),

  // Base config, on every file.
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.es2025 },
    },
    linterOptions: { reportUnusedDisableDirectives: "error" },
  },
  js.configs.recommended,

  // React
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    extends: [
      react,
      reactHooks.configs.flat.recommended,
      jsxA11y.configs.recommended,
    ],
    settings: { ...react.settings, ...resolver },
    rules: {
      ...atError(react.rules),
      ...atError(reactHooks.configs.flat.recommended.rules),
      "@eslint-react/no-missing-component-display-name": "error",
      "@eslint-react/no-missing-context-display-name": "error",
      "@eslint-react/no-duplicate-key": "error",
      "@eslint-react/dom-no-unsafe-target-blank": "error",
      "@eslint-react/dom-no-unknown-property": "error",
      "@eslint-react/no-class-component": "error",
      // Safari drops list semantics from unstyled lists, so DESIGN §6.11
      // requires an explicit role="list" on them; the rule's default
      // exceptions are kept.
      "jsx-a11y-x/no-redundant-roles": [
        "error",
        { nav: ["navigation"], ul: ["list"], ol: ["list"] },
      ],
    },
  },

  // Tailwind classes: only what the generated theme defines, on the
  // project's fixed scales (scripts/tailwind-theme.mjs,
  // scripts/tailwind-classes.mjs).
  {
    files: ["app/**/*.{ts,tsx}"],
    plugins: { "better-tailwindcss": betterTailwindcss },
    settings: { "better-tailwindcss": { entryPoint: "app/styles/app.css" } },
    rules: {
      // The stylesheets' own component classes are known too.
      "better-tailwindcss/no-unknown-classes": [
        "error",
        { ignore: componentClasses().map(name => `^${name}$`) },
      ],
      "better-tailwindcss/no-restricted-classes": [
        "error",
        { restrict: RESTRICTED_CLASSES },
      ],
      "better-tailwindcss/no-conflicting-classes": "error",
      "better-tailwindcss/no-duplicate-classes": "error",
      "better-tailwindcss/no-deprecated-classes": "error",
      "better-tailwindcss/no-concatenated-classes": "error",
    },
  },

  // TypeScript
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      tseslintConfigs.recommended,
      importX.recommended,
      importX.typescript,
    ],
    settings: resolver,
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      ...importWarningsAsErrors,
    },
  },
  // `wrangler types` generates `interface Env extends __BaseEnv_Env {}`,
  // which names the type workers read. Only that file may declare an
  // interface that just extends another.
  {
    files: ["worker-configuration.d.ts"],
    rules: {
      "@typescript-eslint/no-empty-object-type": [
        "error",
        { allowInterfaces: "with-single-extends" },
      ],
    },
  },

  // Node: scripts and config files.
  {
    files: ["**/*.{js,mjs,cjs}"],
    extends: [importX.recommended, importX.typescript],
    settings: {
      ...resolver,
      "import-x/extensions": [".js", ".mjs", ".ts", ".tsx"],
    },
    rules: importWarningsAsErrors,
  },
  {
    files: [
      "**/*.{js,mjs,cjs}",
      "*.config.ts",
      "test/**",
      "e2e/**",
      "scripts/**",
    ],
    languageOptions: { globals: globals.node },
  }
);

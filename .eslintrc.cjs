/**
 * Every exported binding must be imported somewhere, except the framework
 * entry points that Remix, Vite, Wrangler and PostCSS load by name.
 */
const noUnusedModules = [
  "error",
  {
    unusedExports: true,
    ignoreExports: [
      "app/routes/**",
      "app/root.tsx",
      "app/entry.*.tsx",
      "*.config.{js,ts}",
      "functions/**",
    ],
  },
];

/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
    },
  },
  env: {
    browser: true,
    commonjs: true,
    es6: true,
  },

  // Base config
  extends: ["eslint:recommended"],

  overrides: [
    // React
    {
      files: ["**/*.{js,jsx,ts,tsx}"],
      plugins: ["react", "jsx-a11y"],
      extends: [
        "plugin:react/recommended",
        "plugin:react/jsx-runtime",
        "plugin:react-hooks/recommended",
        "plugin:jsx-a11y/recommended",
      ],
      rules: {
        // Safari drops list semantics from unstyled lists, so DESIGN §6.11
        // requires an explicit role="list" on them; the rule's default
        // exceptions are kept.
        "jsx-a11y/no-redundant-roles": [
          "error",
          { nav: ["navigation"], ul: ["list"], ol: ["list"] },
        ],
      },
      settings: {
        react: {
          version: "detect",
        },
        formComponents: ["Form"],
        linkComponents: [
          { name: "Link", linkAttribute: "to" },
          { name: "NavLink", linkAttribute: "to" },
        ],
        "import/resolver": {
          typescript: {},
        },
      },
    },

    // Typescript
    {
      files: ["**/*.{ts,tsx}"],
      plugins: ["@typescript-eslint", "import"],
      parser: "@typescript-eslint/parser",
      settings: {
        "import/internal-regex": "^~/",
        "import/resolver": {
          node: {
            extensions: [".ts", ".tsx"],
          },
          typescript: {
            alwaysTryTypes: true,
          },
        },
      },
      extends: [
        "plugin:@typescript-eslint/recommended",
        "plugin:import/recommended",
        "plugin:import/typescript",
      ],
      rules: {
        "@typescript-eslint/no-unused-vars": [
          "error",
          {
            argsIgnorePattern: "^_",
            varsIgnorePattern: "^_",
          },
        ],
        "import/no-unused-modules": noUnusedModules,
      },
    },

    // Node: scripts and config files
    {
      files: ["**/*.{js,mjs,cjs}"],
      env: {
        node: true,
      },
    },
    {
      files: ["**/*.{js,mjs,cjs}"],
      plugins: ["import"],
      // import/typescript lets the plugin parse the .ts modules that the
      // scripts import and the tests that import the scripts.
      extends: ["plugin:import/recommended", "plugin:import/typescript"],
      // plugin:import/recommended pins ES2018; scripts use import.meta.
      parserOptions: {
        ecmaVersion: "latest",
      },
      settings: {
        "import/extensions": [".js", ".mjs", ".ts", ".tsx"],
        "import/resolver": {
          typescript: {},
          node: {},
        },
      },
      rules: {
        "import/no-unused-modules": noUnusedModules,
      },
    },
  ],
};

import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // base44/ (Deno backend functions) and tests/ (Deno tests) are checked with `npm run test:backend`
  // and `npm run test:frontend` instead. Formatting is left to Prettier (.prettierrc), not lint.
  { ignores: ["dist", "base44", "tests", "src/routeTree.gen.ts"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // Base44 entity records arrive as untyped JSON; src/lib/live.ts is where they get their types.
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);

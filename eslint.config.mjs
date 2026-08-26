import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "node_modules/**",
      "**/node_modules/**",
      "**/dist/**",
      "**/release/**",
      "apps/license-server/data/**",
      "coverage/**",
      "docs/**",
      "assets/**",
      ".codex_pydeps/**",
      ".gradle-user-fresh/**",
      "web-page/**",
      "*.cmd"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["apps/frontend/cypress/**/*.{js,cjs,mjs,ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-expressions": "off",
      "no-unused-expressions": "off"
    }
  },
  {
    files: ["**/*.{js,cjs}"],
    languageOptions: {
      sourceType: "commonjs",
      globals: {
        ...globals.node,
        ...globals.browser
      }
    },
    rules: {
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "no-redeclare": "off",
      "no-undef": "off",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-useless-assignment": "off",
      "no-empty": "off"
    }
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser
      }
    },
    rules: {
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-useless-assignment": "off",
      "no-empty": "off"
    }
  }
];

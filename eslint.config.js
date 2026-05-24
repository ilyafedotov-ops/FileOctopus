import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "**/dist/**",
      "**/target/**",
      "**/node_modules/**",
      "apps/desktop-tauri/src-tauri/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "no-undef": "off",
      "no-debugger": "error",
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  {
    files: [
      "**/tests/**/*.{ts,tsx}",
      "**/*.test.{ts,tsx}",
      "e2e/**",
      "e2e-tauri/**",
    ],
    rules: {
      "no-console": "off",
    },
  },
];

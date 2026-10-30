import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Prettier owns formatting; this turns off ESLint rules that would fight it.
  prettier,
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated reports and local-only folders:
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "reference/**",
    "yes-website-redesign/**",
  ]),
]);

export default eslintConfig;

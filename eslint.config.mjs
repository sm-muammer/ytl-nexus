import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  // Prettier owns formatting; this turns off ESLint rules that would fight it.
  prettier,
  // Components use semantic tokens. Raw hex values live in app/globals.css and
  // lib/design/tokens.ts only (Requirement 2.12).
  {
    files: [
      "app/**/*.{ts,tsx}",
      "components/**/*.{ts,tsx}",
      "modules/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/#[0-9a-fA-F]{3,8}\\b/]",
          message:
            "Raw hex colour. Use a semantic token (for example bg-canvas) or import from lib/design/tokens.",
        },
        {
          selector: "TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}\\b/]",
          message: "Raw hex colour in a template string. Use a semantic token.",
        },
      ],
    },
  },
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
    "roundcube/**",
  ]),
]);

export default eslintConfig;

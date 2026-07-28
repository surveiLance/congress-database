import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    ".wrangler/**",
    "dist/**",
    "out/**",
    "build/**",
    "backup/**",
    "next-env.d.ts",
  ]),
]);

export default config;

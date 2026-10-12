import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored MediaPipe wasm glue + models, copied by scripts/fetch-pose-assets.mjs (gitignored).
    "public/mediapipe/**",
    // The demo film (Remotion), its own package: never part of the app.
    "video/**",
    // Anchor workspace, Android shell and generated vault client are not app source.
    "anchor/**",
    "android/**",
    "src/lib/solana/vault/generated/**",
  ]),
]);

export default eslintConfig;

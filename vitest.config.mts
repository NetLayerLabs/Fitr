import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Vite 8 resolves tsconfig "paths" (the "@/..." alias) natively; no plugin needed.
    tsconfigPaths: true,
    // `server-only` throws on import outside a React Server environment; tests import server
    // modules directly.
    alias: { "server-only": fileURLToPath(new URL("./src/test/empty-module.ts", import.meta.url)) },
  },
  test: {
    // Pure engine tests run in node; component tests opt in with
    // `// @vitest-environment jsdom` at the top of the file.
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});

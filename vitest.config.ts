import { defineConfig } from "vitest/config";

/**
 * The engine is plain TypeScript with no React or Next imports, so the tests
 * need no environment beyond node.
 *
 * The empty postcss override is load-bearing: without it Vite picks up the
 * app's postcss.config.mjs, whose Tailwind v4 plugin is a bare string that
 * Next resolves but Vite does not, and every test run dies before collection.
 */
export default defineConfig({
  css: { postcss: { plugins: [] } },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});

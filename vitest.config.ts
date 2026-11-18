import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests only: pure TypeScript and route handlers in a Node environment. No JSX is rendered here,
// so no React plugin is needed. `@/` mirrors the tsconfig path alias (vitest does not read tsconfig paths).
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    exclude: ["**/node_modules/**", "blueprints/**", "tests/e2e/**"],
    setupFiles: ["./tests/setup/unit.ts"],
    unstubEnvs: true,
    clearMocks: true,
    restoreMocks: true,
  },
});

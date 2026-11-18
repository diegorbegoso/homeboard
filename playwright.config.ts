import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Playwright does not read .env files. Load the same file Next reads so the test process and the
// server it starts agree on every value (`pnpm env:local` writes it). Absent file = CI-provided env.
if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

const PORT = 3100;

export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: ["**/blueprints/**"],
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? "github" : "list",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "mobile-chromium", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: `pnpm build && pnpm start --port ${PORT}`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});

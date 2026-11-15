import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ??
  (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
export default defineConfig({
  testDir: "./tests",
  testMatch: "*.spec.ts",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3100", launchOptions: { executablePath } },
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    env: {
      GAME_REPOSITORY: "memory",
      ALLOW_IN_MEMORY: "true",
      COOKIE_SECURE: "false",
      NEXT_TELEMETRY_DISABLED: "1",
    },
    reuseExistingServer: false,
  },
});

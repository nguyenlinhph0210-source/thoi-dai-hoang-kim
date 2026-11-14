import { defineConfig } from '@playwright/test';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
process.env.GAME_E2E_DATA_DIR ??= mkdtempSync(join(tmpdir(), 'dai-noi-ky-e2e-'));
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
export default defineConfig({
  testDir: './tests',
  testMatch: '*.spec.ts',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:3100', launchOptions: { executablePath } },
  webServer: {
    command: 'npm run start -- --hostname 127.0.0.1 --port 3100',
    url: 'http://127.0.0.1:3100',
    env: { GAME_DATA_DIR: process.env.GAME_E2E_DATA_DIR, NEXT_TELEMETRY_DISABLED: '1' },
    reuseExistingServer: false,
  },
});

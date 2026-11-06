import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir:'./tests/e2e',testMatch:'pwa.spec.ts',
  use:{baseURL:'http://127.0.0.1:4173',browserName:'chromium',launchOptions:{executablePath:process.env.MC_CHROMIUM_PATH}},
  webServer:{command:'npm run preview',url:'http://127.0.0.1:4173',reuseExistingServer:!process.env.CI},
});

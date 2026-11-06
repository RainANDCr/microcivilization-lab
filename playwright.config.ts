import {defineConfig} from '@playwright/test';
const production=process.env.MC_PREVIEW==='1';
const url=production?'http://127.0.0.1:4173':'http://127.0.0.1:5173';
export default defineConfig({
  testDir:'./tests/e2e',testMatch:'living-world.spec.ts',
  expect:{timeout:15000},
  use:{baseURL:url,headless:true},
  webServer:{command:production?'npm run preview':'npm run dev',url,reuseExistingServer:!process.env.CI},
  projects:[
    {name:'chromium',use:{browserName:'chromium',launchOptions:{executablePath:process.env.MC_CHROMIUM_PATH}}},
    ...(process.env.MC_CROSS_BROWSER==='1'?[
      {name:'firefox',use:{browserName:'firefox' as const,launchOptions:{firefoxUserPrefs:{'webgl.force-enabled':true}}}},
      {name:'webkit',use:{browserName:'webkit' as const}},
    ]:[]),
  ],
});

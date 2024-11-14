const { defineConfig, devices } = require('@playwright/test');

// Base Chrome configuration that will be used by all tests
const chromeConfig = {
  use: { 
    ...devices['Desktop Chrome'],
    channel: 'chrome',
    permissions: ['clipboard-write'],
  },
};

const config = defineConfig({
  testDir: './src',
  stopOnFirstFailure: false,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['html', { outputFolder: 'test-reports/html-report' }],
    ['./src/helpers/customReporter.js'] 
  ],
  use: {
    trace: 'on-first-retry',
    headless: false,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 0,
    ignoreHTTPSErrors: true,
  },
  projects: [
   //  {
//       name: 'quick2',
 //     testMatch: '**/quick2.test.js',
 //     use: chromeConfig.use,
 //   },
 //   {
 //     name: 'quick',
 //     testMatch: '**/quick.test.js',
 //     use: chromeConfig.use,
 //   },
    {
      name: 'cleaner',
      testMatch: '**/cleaner.test.js',
      use: chromeConfig.use,
    },
    {
      name: 'chat',
      testMatch: '**/validate_chat.test.js',
      use: chromeConfig.use,
    },
    {
      name: 'trial',
      testMatch: '**/validate_free_trial.test.js',
      use: chromeConfig.use,
    },
    {
      name: 'upload',
      testMatch: '**/upload_video.test.js', 
      use: chromeConfig.use,
    },
    {
      name: 'playlist',
      testMatch: '**/create_playlist.test.js',
      use: chromeConfig.use,
    },
    {
      name: 'stream',
      testMatch: '**/create_stream.test.js',
      use: chromeConfig.use,
    },
    {
      name: 'vod2live',
      testMatch: '**/create_vod2live.test.js',
      use: chromeConfig.use,
    },
    {
      name: 'folder',
      testMatch: '**/create_folder.test.js',
      use: chromeConfig.use,
    },
    {
      name: 'expo',
      testMatch: '**/create_expo.test.js',
      use: chromeConfig.use,
    },
    {
      name: 'schedule',
      testMatch: '**/create_schedule.test.js',
      use: chromeConfig.use,
    },
    {
      name: 'analytics',
      testMatch: '**/validate_analytics.test.js',
      use: chromeConfig.use,
    }
  ],
});

module.exports = config;
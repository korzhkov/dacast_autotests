const { defineConfig, devices } = require('@playwright/test');

// Base Chrome configuration that will be used by all tests
const chromeConfig = {
  use: {
    ...devices['Desktop Chrome'],
    channel: 'chrome',
    permissions: ['clipboard-write'],
    // Creates a new browser context for each test to prevent memory leaks
    browserContext: 'force-new',
    launchOptions: {
      // Prevents crashes in Docker/Linux due to memory limits
      args: ['--disable-dev-shm-usage'],
    },
  },
};

const config = defineConfig({
  testDir: './src',
  stopOnFirstFailure: false,
  // Disabled parallel execution to better control resource usage
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Limit concurrent tests to prevent server overload
  workers: 2,
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['html', { outputFolder: 'test-reports/html-report' }],
    ['./src/helpers/customReporter.js'],
  ],
  use: {
    trace: 'on-first-retry',
    headless: false,
    viewport: { width: 1280, height: 720 },
    // 5 minutes timeout for actions to prevent hanging tests
    actionTimeout: 300000,
    ignoreHTTPSErrors: true,
    contextOptions: {
      // Reduces CPU usage by minimizing animations
      reducedMotion: 'reduce',
    },
  },
  // Added to clean up Chrome processes after tests complete
  globalTeardown: require.resolve('./globalTeardown'),
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
    },
    {
      name: 'forms',
      testMatch: '**/validate_forms.test.js',
      use: chromeConfig.use,
    },
    {
      name: 'stream_lookup',
      testMatch: '**/api_stream_lookup.test.js',
      use: chromeConfig.use,
    },
    {
      name: 'api_playlist',
      testMatch: '**/api_playlist.test.js',
      use: chromeConfig.use,
    },
    {
      name: 'trimming_vod',
      testMatch: '**/trimming_vod.test.js',
      use: chromeConfig.use,
    },
  ],
});

module.exports = config;

const { chromium, chrome } = require('@playwright/test');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

/**
 * Global teardown function that runs after all tests are completed
 * Helps to clean up browser processes and prevent memory leaks
 */
async function globalTeardown() {
  try {
    // Close all browser instances
    await chrome.killAll();     // for Chrome browser
    await chromium.killAll();   // as a fallback mechanism
    
    // Clean up hanging Chrome processes (Linux only)
    // This is needed because sometimes browser processes might not be properly terminated
    if (process.platform === 'linux') {
      await exec('pkill -f chrome');
    }
  } catch (error) {
    console.error('Error during teardown:', error);
  }
}

module.exports = globalTeardown; 
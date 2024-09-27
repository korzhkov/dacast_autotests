const { test, expect } = require('./utils');

test.beforeAll(async () => {
  clipboardy = await import('clipboardy');
});

test('Test Name', async ({ page }) => {
  // Set a longer timeout for this test as stream creation might take a while
  test.setTimeout(300000);
// This is not even started yet
  await page.pause();

await test.step('Clean Videos', async () => {

    await page.pause();

});
}); 
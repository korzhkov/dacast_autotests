const { test, expect } = require('@playwright/test');
const path = require('path');
require('dotenv').config();

test('Create stream test', async ({ page }) => {
  // Increase timeout to 5 minutes
  test.setTimeout(300000);

  const host = process.env._HOST;
  const username = process.env._USERNAME;
  const password = process.env._PASSWORD;

  await test.step('Login', async () => {
    // Navigate to the login page
    await page.goto(`https://${host}/login`);

    // Fill in login credentials and submit
    await page.getByLabel('Email').fill(username);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole('button', { name: 'Log In' }).click();
  });

  await test.step('Check for existing videos and upload if necessary', async () => {
    // Go to the Videos page
    await page.locator('#scrollbarWrapper').getByText('Videos').click();
    
    // Wait for either video links or the "Upload your first Video!" message
    await Promise.race([
      page.waitForSelector('a[href^="/videos/"]', { timeout: 10000 }),
      page.waitForSelector('text="Upload your first Video!"', { timeout: 10000 })
    ]);

    // Check if there's a message about uploading the first video
    const noVideosText = await page.locator('text="Upload your first Video!"').count();
    if (noVideosText > 0) {
      // If the message is found, log a message and run the upload_video.test.js
      console.log('No videos found. Running upload_video.test.js');
      const { uploadVideo } = require('./upload_video.test.js');
      await uploadVideo({ page });
    }
  });

  await test.step('Create VOD Stream', async () => {
    // Start the process of creating a new stream
    await page.getByRole('button', { name: 'Add +' }).click();
    await page.getByText('Live Stream', { exact: true }).click();
    await page.locator('.sc-fPrdXf > div:nth-child(4) > div').first().click();
    await page.getByRole('button', { name: 'Next' }).click();

    // Select the first video file for the stream
    await page.locator('label').filter({ hasText: 'sample_video.MOV' }).locator('span').first().click();
    
    // Complete the stream creation process
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.getByRole('button', { name: 'Done' }).click();
  });

  await test.step('Navigate to LiveStreams page', async () => {
    // Go to the Live Streams page
    await page.locator('#scrollbarWrapper').getByText('Live Streams').click();

    // Check if there's a message about creating the first stream
    const createFirstStreamText = await page.locator('text="Create your first Live Stream!"').count();
    
    if (createFirstStreamText > 0) {
      // If the message is found, wait for 5 seconds and reload the page
      await page.waitForTimeout(5000);
      await page.reload();
    }

    // Wait for either stream links or the "Create your first Live Stream!" message
    await Promise.race([
      page.waitForSelector('a[href^="/livestreams/"]', { timeout: 30000 }),
      page.waitForSelector('text="Create your first Live Stream!"', { timeout: 30000 })
    ]);

    // If there are still no stream links, wait again and reload
    if (!(await page.$('a[href^="/livestreams/"]'))) {
      await page.waitForTimeout(5000);
      await page.reload();
      await page.waitForSelector('a[href^="/livestreams/"]', { timeout: 30000 });
    }
  });

  await test.step('Find and open created livestream', async () => {
    // Find all livestream links
    const livestreamLinks = await page.$$('a[href^="/livestreams/"]');
    let livestreamClicked = false;

    // Click on the first livestream that includes "Pre-recorded stream" in its text
    for (const link of livestreamLinks) {
      const linkText = await link.textContent();
      if (linkText.includes('Pre-recorded stream')) {
        await link.click();
        livestreamClicked = true;
        break;
      }
    }

    // Ensure that a livestream was found and clicked
    expect(livestreamClicked).toBeTruthy();
  });

  await test.step('Edit livestream description', async () => {
    // Update the livestream description
    await page.locator('textarea[type="textarea"]').fill('This is a test livestream');

    // Save the changes
    await page.locator('#pageContentContainer div').filter({ hasText: 'Title Date Status Features' }).nth(2).click();

    // Verify that the changes were saved successfully
    await expect(page.locator('text="Changes have been saved"')).toBeVisible({ timeout: 5000 });
  });
});

/* to do
Add error handling
Add cleaning (delete livestream after test)
*/

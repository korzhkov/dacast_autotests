const { test, expect } = require('@playwright/test');
require('dotenv').config();

test('Create playlist test', async ({ page }) => {
  // Set a longer timeout for this test as video upload and playlist creation might take a while
  test.setTimeout(300000);

  // Load environment variables
  const host = process.env._HOST;
  const username = process.env._USERNAME;
  const password = process.env._PASSWORD;

  await test.step('Login', async () => {
    // Navigate to the login page and authenticate
    await page.goto(`https://${host}/login`);
    await page.getByLabel('Email').fill(username);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole('button', { name: 'Log In' }).click();
  });

  await test.step('Navigate to Videos page', async () => {
    await page.locator('#scrollbarWrapper').getByText('Videos').click();
    
    // Wait for either the "Upload your first Video!" text or the video list to appear
    await Promise.race([
      page.waitForSelector('text="Upload your first Video!"', { timeout: 60000 }),
      page.waitForSelector('a[href^="/videos/"]', { timeout: 60000 })
    ]);
  });

  await test.step('Check and upload videos if necessary', async () => {
    // Function to check for existing videos
    async function checkExistingVideos() {
      const noVideosText = await page.locator('text="Upload your first Video!"').count();
      if (noVideosText > 0) {
        return { sample1Exists: false, sample2Exists: false };
      }

      const videoLinks = await page.$$('a[href^="/videos/"]');
      let sample1Exists = false;
      let sample2Exists = false;

      for (const link of videoLinks) {
        const linkText = await link.textContent();
        if (linkText.includes('sample_video.MOV')) sample1Exists = true;
        if (linkText.includes('sample_video2.MOV')) sample2Exists = true;
      }

      return { sample1Exists, sample2Exists };
    }

    // Function to upload a video
    async function uploadVideo(filename) {
      await page.getByRole('button', { name: 'Add +' }).click();
      await page.locator('#undefined_vod').click();

      const fileInput = await page.$('#browseButton');
      expect(fileInput).toBeTruthy();

      await page.evaluate((el) => { el.style.display = 'block'; }, fileInput);
      await fileInput.setInputFiles(filename);
      await page.evaluate((el) => { el.style.display = 'none'; }, fileInput);

      await page.getByPlaceholder('Search by Title...').fill(filename);
      await page.getByRole('button', { name: 'Upload' }).click();

      await page.waitForTimeout(30000);

      // Navigate back to the Videos page
      await page.locator('#scrollbarWrapper').getByText('Videos').click();
      await Promise.race([
        page.waitForSelector('text="Upload your first Video!"', { timeout: 60000 }),
        page.waitForSelector('a[href^="/videos/"]', { timeout: 60000 })
      ]);
    }

    // Check for existing videos and upload if needed
    let { sample1Exists, sample2Exists } = await checkExistingVideos();

    if (!sample1Exists) {
      await uploadVideo('sample_video.MOV');
      ({ sample1Exists, sample2Exists } = await checkExistingVideos());
    }

    if (!sample2Exists) {
      await uploadVideo('sample_video2.MOV');
    }
  });

  await test.step('Create playlist', async () => {
    await page.getByRole('button', { name: 'Add +' }).click();
    await page.getByText('Playlist', { exact: true }).click();

    const unixTime = Math.floor(Date.now() / 1000);
    const playlistName = `This is a test playlist ${unixTime}`;
    await page.locator('#playlistModalInput').first().fill(playlistName);
    await page.getByRole('button', { name: 'Create' }).click();

    // Validate playlist creation
    await expect(page.locator(`text="${playlistName}"`).first()).toBeVisible({ timeout: 5000 });
  });
  await test.step('Add videos to playlist', async () => {
    await page.getByText('Contents').click();
    await page.locator('div').filter({ hasText: /^sample_video2\.MOV$/ }).locator('label div').first().click();
    await page.locator('div').filter({ hasText: /^sample_video\.MOV$/ }).locator('label div').first().click();
    await page.locator('div:nth-child(4) > div:nth-child(2) > button').first().click();
    await page.waitForTimeout(5000); // Required because previous message is still on the screen
    await page.getByRole('button', { name: 'Save' }).click();
        // Validate changes have been saved
    await expect(page.locator('text="Changes have been saved"')).toBeVisible({ timeout: 5000 });
  });
});

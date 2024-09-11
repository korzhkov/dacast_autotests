const { test, expect } = require('./utils');
const { uploadVideo } = require('./helpers/fileUploader');

test('Create playlist test', async ({ page }) => {
  // Set a longer timeout for this test as video upload and playlist creation might take a while
  test.setTimeout(300000);

  await test.step('Navigate to Videos page', async () => {
    await page.locator('#scrollbarWrapper').getByText('Videos').click();
    
    // Wait for either "Upload your first Video!" text or the list of videos
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

    let { sample1Exists, sample2Exists } = await checkExistingVideos();

    // Upload sample_video.MOV if it doesn't exist
    if (!sample1Exists) {
      await uploadVideo(page, 'sample_video.MOV');
      ({ sample1Exists, sample2Exists } = await checkExistingVideos());
    }

    // Upload sample_video2.MOV if it doesn't exist
    if (!sample2Exists) {
      await uploadVideo(page, 'sample_video2.MOV');
    }
  });

  await test.step('Create playlist', async () => {
    await page.getByRole('button', { name: 'Add +' }).click();
    await page.getByText('Playlist', { exact: true }).click();

    // Generate a unique playlist name using current timestamp
    const unixTime = Math.floor(Date.now() / 1000);
    const playlistName = `This is a test playlist ${unixTime}`;
    await page.locator('#playlistModalInput').first().fill(playlistName);
    await page.getByRole('button', { name: 'Create' }).click();

    // Validate playlist creation
    await expect(page.locator(`text="${playlistName}"`).first()).toBeVisible({ timeout: 10000 });
  });

  await test.step('Add videos to playlist', async () => {
    await page.getByText('Contents').click();
    // Select sample_video2.MOV
    await page.locator('div').filter({ hasText: /^sample_video2\.MOV$/ }).locator('label div').first().click();
    // Select sample_video.MOV
    await page.locator('div').filter({ hasText: /^sample_video\.MOV$/ }).locator('label div').first().click();
    // Click the "Add to playlist" button
    await page.locator('div:nth-child(4) > div:nth-child(2) > button').first().click();
    // Wait for the previous message to disappear
    await page.waitForTimeout(5000);
    // Save the changes
    await page.getByRole('button', { name: 'Save' }).click();
    // Validate that changes have been saved
    await expect(page.locator('text="Changes have been saved"')).toBeVisible({ timeout: 5000 });
  });
});

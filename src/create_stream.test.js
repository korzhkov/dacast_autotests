const { test, expect } = require('./utils');
const { uploadVideo } = require('./helpers/fileUploader');

test('Create stream test', async ({ page }) => {
  // Set a longer timeout for this test as stream creation might take a while
  test.setTimeout(300000);

  await test.step('Check for existing videos and upload if necessary', async () => {
    // Navigate to the Videos page
    await page.locator('#scrollbarWrapper').getByText('Videos').click();
    
    // Wait for either video links or the "Upload your first Video!" message
    await Promise.race([
      page.waitForSelector('a[href^="/videos/"]', { timeout: 10000 }),
      page.waitForSelector('text="Upload your first Video!"', { timeout: 10000 })
    ]);

    // Check if there's a message about uploading the first video
    const noVideosText = await page.locator('text="Upload your first Video!"').count();
    if (noVideosText > 0) {
      console.log('No videos found. Uploading a video.');
      await uploadVideo(page, 'sample_video.MOV');
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
    // Navigate to the Live Streams page
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

  // Additional test steps can be added here
  // ...
});
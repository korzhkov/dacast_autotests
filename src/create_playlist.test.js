const { test, expect } = require('./utils');
const { uploadVideo } = require('./helpers/fileUploader');

test('Create playlist test', async ({ page, browser }) => {
  console.log(`Using browser: ${browser.browserType().name()}`);
  console.log(`Browser version: ${browser.version()}`);
  console.log(`User agent: ${await page.evaluate(() => navigator.userAgent)}`);
  // Set a longer timeout for this test as video upload and playlist creation might take a while
  test.setTimeout(300000);

  await test.step('Navigate to Videos page', async () => {
    await page.locator('#scrollbarWrapper').getByText('Videos').click();
    
    // Wait for either "Upload your first Video!" text or the list of videos
    await Promise.race([
      page.waitForSelector('text="Upload your first Video!"', { timeout: 60000 }),
      page.waitForSelector('a[href^="/videos/"]', { timeout: 60000 })
    ]);
    console.log('Successfully navigated to Videos page');
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
      console.log('Uploading sample_video.MOV');
      await uploadVideo(page, 'sample_video.MOV');
      ({ sample1Exists, sample2Exists } = await checkExistingVideos());
      console.log('sample_video.MOV uploaded successfully');
    }

    // Upload sample_video2.MOV if it doesn't exist (playlist requires at least 2 videos)
    if (!sample2Exists) {
      console.log('Uploading sample_video2.MOV');
      await uploadVideo(page, 'sample_video2.MOV');
      console.log('sample_video2.MOV uploaded successfully');
    }
  });

  await test.step('Create playlist', async () => {
    console.log('Creating new playlist');
    await page.getByRole('button', { name: 'Add +' }).click();
    await page.getByText('Playlist', { exact: true }).click();

    // Generate a unique playlist name using current timestamp
    const currentDate = new Date();
    const formattedDate = `${currentDate.toISOString().slice(0, 19).replace('T', ' ')}.${currentDate.getMilliseconds().toString().padStart(3, '0')}`;
    const playlistName = `This is a test playlist ${formattedDate}`;
    await page.locator('#playlistModalInput').first().fill(playlistName);
    await page.getByRole('button', { name: 'Create' }).click();

    // Validate playlist creation
    await expect(page.locator(`text="${playlistName}"`).first()).toBeVisible({ timeout: 10000 });
    console.log(`Playlist "${playlistName}" created successfully`);
  });

  await test.step('Add videos to playlist', async () => {
    console.log('Attempting to find and add videos to playlist, might take a while if those just uploaded...');

    async function findVideos() {
      await page.getByText('Contents').click();
      await page.waitForTimeout(2000); // Little pause after clicking on Contents

      // Wait until at least one list item appears
      await page.waitForSelector('div[role="listitem"]', { timeout: 5000 }).catch(() => {});

      const video1 = await page.locator('div').filter({ hasText: /^sample_video\.MOV$/ }).count();
      const video2 = await page.locator('div').filter({ hasText: /^sample_video2\.MOV$/ }).count();

      return video1 > 0 && video2 > 0;
    }

    let attempts = 0;
    const maxAttempts = 5; // 5 attempts to find videos (maybe could be less)

    while (attempts < maxAttempts) {
      console.log(`Attempt ${attempts + 1} to find videos`);
      
      if (await findVideos()) {
        console.log('Videos found successfully');
        break;
      }

      console.log('Videos not found. Waiting and refreshing...');
      await page.waitForTimeout(10000);
      await page.reload();
      attempts++;
    }

    if (attempts === maxAttempts) {
      throw new Error('Videos not found after 5 attempts');
    }

    console.log('Adding videos to playlist');

    // Add videos to playlist
    await page.locator('div').filter({ hasText: /^sample_video2\.MOV$/ }).locator('label div').first().click();
    await page.locator('div').filter({ hasText: /^sample_video\.MOV$/ }).locator('label div').first().click();
    // Click the "Add to playlist" button (arrow)
    await page.locator('div:nth-child(4) > div:nth-child(2) > button').first().click();
    // Don't remember why, but it requires a pause (reduced to 2 seconds, maybe could be less)
    await page.waitForTimeout(2000);
    await page.getByRole('button', { name: 'Save' }).click();
    // Validate that changes have been saved
    await expect(page.locator('text="Changes have been saved"')).toBeVisible({ timeout: 5000 });
    console.log('Videos added to playlist successfully');
  });

  await test.step('Check video playback', async () => {
    // Navigate to the playlist preview
    await page.getByRole('button', { name: 'Preview' }).nth(1).click();
    // Just to be sure the focus is on the video player pop-up
    await page.locator('span').filter({ hasText: 'Preview' }).click(); 

    // Wait for the videos to load
    await page.waitForTimeout(10000);

    // Run the video 
    await page.getByRole('button', { name: 'Play', exact: false }).click();

    const videoElement = await page.$('video');
  
    // Wait for the video to start playing
    await page.waitForFunction(() => {
      const video = document.querySelector('video');
      return video && video.currentTime > 0 && !video.paused && !video.ended && video.readyState > 2;
    }, { timeout: 30000 });
    // Check if the video is playing
    const isPlaying = await videoElement.evaluate((video) => {
      return !!(video.currentTime > 0 && !video.paused && !video.ended && video.readyState > 2);
    });
    expect(isPlaying).toBe(true);
    console.log('Video is playing');
    // Visual check (with sound)
    await page.waitForTimeout(5000);
  });
});
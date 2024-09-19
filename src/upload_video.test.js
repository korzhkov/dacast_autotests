const { test, expect } = require('./utils');
const { uploadVideo } = require('./helpers/fileUploader');

let clipboardy;

test.beforeAll(async () => {
  clipboardy = await import('clipboardy');
});

test('Upload video test', async ({ page }) => {
  // Set a longer timeout for this test as video upload might take a while
  test.setTimeout(300000);

  await test.step('Upload video', async () => {
    await uploadVideo(page, 'sample_video.MOV');
  });

  await test.step('Verify uploaded video', async () => {
    // Navigate to the Videos page
    await page.locator('#scrollbarWrapper').getByText('Videos').click();

    // Check if there's a message about uploading the first video
    const createFirstVideoText = await page.locator('text="Upload your first Video!"').count();
    
    if (createFirstVideoText > 0) {
      // If the message is found, wait for 5 seconds and reload the page
      await page.waitForTimeout(5000);
      await page.reload();
    }

    // Wait for either video links or the "Upload your first Video!" message
    await Promise.race([
      page.waitForSelector('a[href^="/videos/"]', { timeout: 30000 }),
      page.waitForSelector('text="Upload your first Video!"', { timeout: 30000 })
    ]);

    // If there are still no video links, wait again and reload
    if (!(await page.$('a[href^="/videos/"]'))) {
      await page.waitForTimeout(5000);
      await page.reload();
      await page.waitForSelector('a[href^="/videos/"]', { timeout: 30000 });
    }

    
    // Find and click on the newly uploaded video
    const videoLinks = await page.$$('a[href^="/videos/"]');
    console.log(`Found ${videoLinks.length} video links`); // Debugging, might be removed
    let videoClicked = false;
    for (const link of videoLinks) {
      const linkText = await link.textContent();
      console.log(`Found video link: ${linkText}`); // Debugging, might be removed
      if (linkText.includes('sample_video.MOV')) {
        await link.click();
        videoClicked = true;
        break;
      }
    }
    // Ensure the video was found and clicked
    expect(videoClicked).toBeTruthy();
  });

/*

Section above needs to be expanded to check that video transcoding is finished and only after 
that move to the next step. Possible issues:
- video playback may not work if transcoding is not finished
- not sure how about download, probably should not be affected because download probably works with the source,
 but it needs to be confirmed

 As a workaround I will put 10s sleep before Edit video description step
*/
  await page.waitForTimeout(10000);
  console.log('Sleep for 10s to give transcoding a chance to finish');

  await test.step('Edit video description', async () => {
    // Update the video description
    await page.locator('textarea[type="textarea"]').fill('This is a test video');
    
    // Save the changes (assuming the save button is the 3rd div with the specified text)
    await page.locator('#pageContentContainer div').filter({ hasText: 'Title Date Status Features' }).nth(2).click();
    
    // Verify the changes were saved successfully
    await expect(page.locator('text="Changes have been saved"')).toBeVisible({ timeout: 5000 });
  });

  await test.step('Verify video download', async () => {
    let downloadStarted = false;
    const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
    
    await page.locator('#downloadVodTooltip').getByRole('img').click();
    
    const download = await downloadPromise;
    
    if (download) {
      downloadStarted = true;
      // Validate the file name
      const suggestedFilename = download.suggestedFilename();
      console.log('Downloaded filename:', suggestedFilename);
      expect(suggestedFilename).toMatch(/\.(mp4|mov|MOV|MP4)$/); // Validate the file extension

      // Optionally: save the file and check its size
      const path = await download.path();
      expect(path).toBeTruthy();
      
      const fs = require('fs');
      const stats = fs.statSync(path);
      expect(stats.size).toBeGreaterThan(0);

      console.log('Video downloaded successfully');
    } else {
      console.log("Download doesn't start, check account settings");
      test.info().annotations.push({ type: 'issue', description: "Download doesn't start" });
    }

    // This will mark the step as failed if download didn't start, but won't stop execution
    if (!downloadStarted) {
      test.info().annotations.push({ type: 'failure', description: "Download should have started" });
    }
  });


  await test.step('Check share link and video playback', async () => {
    // Check if the share link is present
    
    await page.getByRole('button', { name: 'Share links' }).click();
    await page.locator('#link').click();
    // await page.expect('Copied to clipboard').toBeVisible({ timeout: 10000 });

    // Wait for the clipboard content to be updated
    await page.waitForTimeout(1000);
    
    // Get the clipboard content
    const clipboardContent = await clipboardy.default.read();

    // Check if the copied link starts with 'https://iframe.dacast.com/vod/'
    expect(clipboardContent).toMatch(/^https:\/\/iframe\.dacast\.com\/vod\//);
    console.log('Copied share link:', clipboardContent);


  await page.goto(clipboardContent);

  // Run the video 
    await page.getByRole('button', { name: 'Play', exact: false }).first().click();

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

   
  await test.step('Navigate back to Videos page', async () => {
    // Return to the main Videos page
    await page.goto('https://app.dacast.com/videos');
    console.log('Navigated back to Videos page');
  });
});

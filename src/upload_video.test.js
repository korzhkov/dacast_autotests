const { test, expect } = require('./utils');
const { uploadVideo } = require('./helpers/fileUploader');

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

  await test.step('Edit video description', async () => {
    // Update the video description
    await page.locator('textarea[type="textarea"]').fill('This is a test video');
    
    // Save the changes (assuming the save button is the 3rd div with the specified text)
    await page.locator('#pageContentContainer div').filter({ hasText: 'Title Date Status Features' }).nth(2).click();
    
    // Verify the changes were saved successfully
    await expect(page.locator('text="Changes have been saved"')).toBeVisible({ timeout: 5000 });
  });

  await test.step('Navigate back to Videos page', async () => {
    // Return to the main Videos page
    await page.locator('#scrollbarWrapper').getByText('Videos').click();
  });
});

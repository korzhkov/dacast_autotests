const { test, expect } = require('@playwright/test');
require('dotenv').config();

async function uploadVideo({ page }) {
  // Implement the video upload logic here
  await page.getByRole('button', { name: 'Add +' }).click();
  await page.locator('#undefined_vod').click();

  const fileInput = await page.$('#browseButton');
  expect(fileInput).toBeTruthy();

  await page.evaluate((el) => { el.style.display = 'block'; }, fileInput);
  await fileInput.setInputFiles('sample_video.MOV');
  await page.evaluate((el) => { el.style.display = 'none'; }, fileInput);

  await page.getByPlaceholder('Search by Title...').fill('Sample Video');
  await page.getByRole('button', { name: 'Upload' }).click();

  await page.getByText('Complete', { exact: true }).click();
}

test('Upload video test', async ({ page }) => {
  // Set a longer timeout for this test as video upload might take a while
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

  await test.step('Upload video', async () => {
    await uploadVideo({ page });
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
    console.log(`Found ${videoLinks.length} video links`); // // Debugging, might be removed
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

module.exports = { uploadVideo };

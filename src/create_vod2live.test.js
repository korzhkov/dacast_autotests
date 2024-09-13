const { test, expect } = require('./utils');
const { uploadVideo } = require('./helpers/fileUploader');

let clipboardy;

test.beforeAll(async () => {
  clipboardy = await import('clipboardy');
});

test('Create VOD2Live stream test', async ({ page }) => {
  console.log('Starting VOD2Live stream creation test');
  test.setTimeout(300000);

    await test.step('Check for existing videos and upload if necessary', async () => {
    console.log('Checking for existing videos');
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
    } else {
      console.log('Existing videos found');
    }
    await page.locator('#scrollbarWrapper').getByText('Live Streams').click();
  });



  await test.step('Create VOD Stream', async () => {
    // Start the process of creating a new stream
    console.log('Starting VOD Stream creation process');
    await page.getByRole('button', { name: 'Add +' }).click();
    await page.getByText('Live Stream', { exact: true }).click();
    await page.locator('.sc-fPrdXf > div:nth-child(4) > div').first().click();
    await page.getByRole('button', { name: 'Next' }).click();

    console.log('Selecting video file for the stream');
    await page.locator('label').filter({ hasText: 'sample_video.MOV' }).locator('span').first().click();
    
       
    // Complete the stream creation process
    console.log('Completing stream creation process');
    await page.getByRole('button', { name: 'Next' }).click();
    
    // Selecting timezone
    await page.locator('#dropdownTitle').click();
    await page.locator('body').press('Tab');
    await page.getByTestId('method-dropdown').getByPlaceholder('Search').fill('Los');
    await page.waitForTimeout(500);
    await page.getByText('America/Los_Angeles').click();
    await page.locator('#inputscheduledTime').click();
    await page.getByRole('button', { name: 'Create', exact: true }).first().click();

    // Copy the share link
    await page.getByRole('button', { name: 'Copy iFrame Embed Code' }).click();
    
    // Wait for the clipboard content to be updated
    await page.waitForTimeout(1000);

    // Get the clipboard content
    const clipboardContent = await clipboardy.default.read();

// Check if the copied content is an Embed code with the expected structure
    expect(clipboardContent).toMatch(/<div style="position:relative;padding-bottom:56\.25%;overflow:hidden;height:0;max-width:100%;"><iframe id="[\w-]+-live-[\w-]+" src="https:\/\/iframe\.dacast\.com\/live\/[\w-]+\/[\w-]+" width="100%" height="100%" frameborder="0" scrolling="no" allow="autoplay;encrypted-media" allowfullscreen webkitallowfullscreen mozallowfullscreen oallowfullscreen msallowfullscreen style="position:absolute;top:0;left:0;"><\/iframe><\/div>/);
    console.log('Copied Embed code:', clipboardContent);

    
    await page.getByRole('button', { name: 'Done' }).click();
  });

    await test.step('Navigate to LiveStreams page', async () => {
    console.log('Navigating to Live Streams page');
    await page.locator('#scrollbarWrapper').getByText('Live Streams').click();

    // Check if there's a message about creating the first stream
    const createFirstStreamText = await page.locator('text="Create your first Live Stream!"').count();
    
    if (createFirstStreamText > 0) {
      console.log('No streams found. Waiting and reloading the page');
      await page.waitForTimeout(5000);
      await page.reload();
    }

    console.log('Waiting for stream links to appear');
    await Promise.race([
      page.waitForSelector('a[href^="/livestreams/"]', { timeout: 30000 }),
      page.waitForSelector('text="Create your first Live Stream!"', { timeout: 30000 })
    ]);

    // If there are still no stream links, wait again and reload
    if (!(await page.$('a[href^="/livestreams/"]'))) {
      console.log('Stream links not found. Waiting and reloading again');
      await page.waitForTimeout(10000);
      await page.reload();
      await page.waitForSelector('a[href^="/livestreams/"]', { timeout: 30000 });
    }
    await page.waitForTimeout(10000);
    await page.reload();
    
    await page.waitForSelector('a[href^="/livestreams/"]', { timeout: 30000 });
    await page.locator('a[href^="/livestreams/"]').first().click();

    await page.waitForSelector('text="Scheduled"', { timeout: 30000 })
    console.log('Scheduled stream found');

    console.log('VOD2Live stream creation test completed');
  });

  // Additional test steps can be added here
  // ...
});
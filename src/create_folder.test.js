const { test, expect } = require('./utils');
const { uploadVideo } = require('./helpers/fileUploader');
let folderName;

test('Create folder test', async ({ page, browser }) => {
  // Added these when debugged something, 
  console.log(`Using browser: ${browser.browserType().name()}`);
  console.log(`Browser version: ${browser.version()}`);
  console.log(`User agent: ${await page.evaluate(() => navigator.userAgent)}`);
  // Set a longer timeout for this test as video upload and folder creation might take a while
  test.setTimeout(300000);


  // We should put something to folders, so videos or playlists are required. This this preparation step is kind of mandatory
  await test.step('Navigate to Videos page to check for existing videos', async () => {
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

    // Upload sample_video2.MOV if it doesn't exist (folder test requires at least 2 videos)
    if (!sample2Exists) {
      console.log('Uploading sample_video2.MOV');
      await uploadVideo(page, 'sample_video2.MOV');
      console.log('sample_video2.MOV uploaded successfully');
    }
  });


  await test.step('Create folder', async () => {
    console.log('Creating new folder');
    await page.locator('#scrollbarWrapper').getByText('Folders').click();
    await page.getByText('+ Create folder', { exact: true }).click();

    // Generate a unique folder name using current timestamp

    const currentDate = new Date();
    const formattedDate = `${currentDate.toISOString().slice(0, 19).replace('T', ' ')}.${currentDate.getMilliseconds().toString().padStart(3, '0')}`;
    
    // Assign a value to the folderName variable, easier to recognize when something went wrong
    folderName = `This is a test folder ${formattedDate}`; 
    await page.waitForTimeout(2000); // This probably is not necessary, needs to be checked in the future
    await page.locator('#newFolderModalFolderInput').first().fill(folderName);
    await await page.waitForTimeout(2000); // W/o this pause the test fails in about 80% of cases with 
    await page.getByRole('button', { name: 'Create', exact: true }).click();

    // Validate folder creation or catch error
    try {
      await Promise.race([
        expect(page.locator(`text="${folderName}"`).first()).toBeVisible({ timeout: 15000 }),
        expect(page.locator(`text="${folderName} couldn't be created"`)).toBeVisible({ timeout: 15000 })
      ]);

      if (await page.locator(`text="${folderName} couldn't be created"`).isVisible()) {
        console.error(`Error: Folder "${folderName}" couldn't be created`);
        throw new Error(`Failed to create folder "${folderName}"`);
      } else {
        console.log(`Folder "${folderName}" created successfully`);
      }
    } catch (error) {
      console.error('Timeout: Neither success nor error message appeared', error);
      throw error;
    }
  });

// This step is so complicated bacause newly uploaded videos are not immediately visible in media library.
await test.step('Validate that videos are visible in media library', async () => {

  await page.locator('#scrollbarWrapper').getByText('Folders').click();
  
    async function findVideos() {
      await page.getByText('Media library').click();
      console.log('Jumping to media library and attempting to find videos, might take a while if those just uploaded. but normally 2 attempts are enough...');
      await page.waitForTimeout(2000); // Little pause after clicking on Media library

      await page.getByPlaceholder('Search by Title...').click();
      await page.waitForTimeout(500);
      await page.getByPlaceholder('Search by Title...').fill('sample_video');
      await page.waitForTimeout(500);
      await page.getByPlaceholder('Search by Title...').press('Enter');
      await page.waitForTimeout(5000);

      const video1 = await page.locator('div[draggable="true"]').filter({ hasText: 'sample_video.MOV' }).count();
      const video2 = await page.locator('div[draggable="true"]').filter({ hasText: 'sample_video2.MOV' }).count();

      return video1 > 0 && video2 > 0;
    }

    let attempts = 0;
    const maxAttempts = 10; // 10 attempts to find videos (maybe could be less, but I guess it depends of transcoder as well)

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
      throw new Error('Videos not found after 10 attempts');
    }
  });

  await test.step('Drag and drop videos to folder', async () => {
  console.log(`Going to drag and drop video to ${folderName}`);
    // Finding the source element (video  
    const sourceElement = page.locator('div[draggable="true"]').filter({ has: page.locator('span', { hasText: 'sample_video.MOV' }) }).first();
    //const targetElement = page.locator('div.sc-fLvQuD').filter({ hasText: `${folderName}` });
    const targetElement = page.getByText(folderName);
    

    // Ensuring that both elements are visible and accessible
    await expect(sourceElement).toBeVisible();
    await expect(targetElement).toBeVisible();

    // Performing drag and drop
    await sourceElement.dragTo(targetElement);
    console.log(`Drag and drop to ${folderName} completed`);

    // Waiting a bit to complete the operation
    await page.waitForTimeout(2000);
     
  });
  
  await test.step('Move videos to folder', async () => { 
    console.log(`Adding videos to folder ${folderName} via move to option`);
        
    // Finding the video row (by video name)
    const videoRow = page.locator('div[draggable="true"]').filter({ has: page.locator('span', { hasText: 'sample_video2.MOV' }) }).first();
    
    // Clicking on the "More" (three dots) button in this row
    await page.waitForTimeout(5000);
    await videoRow.locator('div.sc-jXbUNg').click();
    
    // Selecting "Move To" from the dropdown menu
    await page.waitForTimeout(5000);
    await page.getByRole('list').locator('li').filter({ hasText: 'Move To' }).click();
    await page.waitForTimeout(5000);
    
    // Selecting the destination folder
    await expect(page.locator(`text="${folderName}"`).nth(1)).toBeVisible({ timeout: 10000 });
    await page.locator(`text="${folderName}"`).nth(1).click();
    
    // Clicking the "Move" button
    await page.getByRole('button', { name: 'Move' }).click();
    
    // Checking the success message
    await expect(page.locator('text="Items moved successfully"')).toBeVisible({ timeout: 10000 });
    console.log(`Videos added to folder ${folderName} successfully`);
  });
  
  // Checking that videos disappeared from media library (requirement!)
  await test.step('Check that videos disappeared from media library when Unsorted toggle is on', async () => {
    await page.locator('#unsortedToggle label').click();
    
    const video1Count = await page.locator('div').filter({ hasText: /^sample_video\.MOV$/ }).count();
    const video2Count = await page.locator('div').filter({ hasText: /^sample_video2\.MOV$/ }).count();
    
    // Following code is clear from console messages.  
    if (video1Count === 0 && video2Count === 0) {
      console.log('Both videos successfully moved: they are no longer visible in the media library');
    } else {
      if (video1Count > 0) {
        console.error('Error: sample_video.MOV is still visible in the media library');
      }
      if (video2Count > 0) {
        console.error('Error: sample_video2.MOV is still visible in the media library');
      }
      throw new Error('One or both videos are still visible in the media library');
    }
  });
  console.log('Test completed successfully: folders created and videos moved via drag and drop and added to folder via move popup menu');
  





  

  /*
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
  }); */
});
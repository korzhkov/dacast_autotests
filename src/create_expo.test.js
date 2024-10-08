const { test, expect } = require('./utils');
const { uploadVideo } = require('./helpers/fileUploader');

let clipboardy;

test.beforeAll(async () => {
  clipboardy = await import('clipboardy');
});

test('Create Expo test', async ({ page, browser }) => {
  console.log('Starting Create Expo test');
  console.log(`Using browser: ${browser.browserType().name()}`);
  console.log(`Browser version: ${browser.version()}`);
  console.log(`User agent: ${await page.evaluate(() => navigator.userAgent)}`);
  // Set a longer timeout for this test as video upload and Expo creation might take a while
  test.setTimeout(300000);

await test.step('Navigate to Videos page to check for existing videos', async () => {
  try {
    console.log('Navigating to Videos page');
    await page.locator('#scrollbarWrapper').getByText('Videos').click( {timeout: 10000} );  
    await Promise.race([
      page.waitForSelector('text="Upload your first Video!"', { timeout: 60000 }),
      page.waitForSelector('a[href^="/videos/"]', { timeout: 60000 })
    ]);
    console.log('Successfully navigated to Videos page');
  } catch (error) {
    console.error('Error navigating to Videos page:', error);
    test.fail(error);
  }
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

  // Added this step to validate videos are transcoded because if they are not, then video will not appear in the Expo.
  // In the future it might be a good idea to move it to helpers and use in other tests
  // It will not handle the case when transcoding has failed and changed status from Processing to Fail(?) (don't remember the right status, seen it just once).
  await test.step('Validate videos are transcoded', async () => {
    console.log('Validating video transcoding');
    await page.locator('#scrollbarWrapper').getByText('Videos').click();
    await page.waitForTimeout(5000);
    await test.step('Checking sample_video status', async () => {
      await page.reload();
      const maxAttempts = 5; // Maximum number of attempts to check video status
      let attempts = 0;
      let processingComplete = false;

      while (attempts < maxAttempts && !processingComplete) {
        console.log(`Attempt ${attempts + 1}: Refreshing page and checking video status`);
        
        // Wait for the table to load
        await page.waitForSelector('#videosListTable', { state: 'visible', timeout: 10000 });

        // Find the row containing 'sample_video(2)?\.MOV'
        const row = await page.locator('#videosListTable tr')
          .filter({ hasText: /sample_video(2)?\.MOV/ })
          .first();

        if (await row.count() > 0) {
          const rowText = await row.innerText();
          console.log(`Found row with sample_video: ${rowText}`);

          // Check the video status
          if (rowText.includes('Processing')) {
            console.log('Video is still in Processing status, will refresh again');
            await page.reload();
            await page.waitForTimeout(5000); // Wait for 5 seconds after reload
          } else if (rowText.includes('Online')) {
            console.log('Video processing completed, status is now Online');
            processingComplete = true;
          } else {
            console.log('Video status is unclear, will refresh again');
          }
        } else {
          console.log('sample_video not found in the list, will try again');
        }

        attempts++;

        if (!processingComplete) {
          console.log('Waiting 10 seconds before next refresh');
          await page.waitForTimeout(10000); // Wait for 10 seconds before next attempt
        }
      }
      if (!processingComplete) {
        console.log('Processing did not complete after maximum attempts');
      }
    });
  });

  await test.step('Create Expo', async () => {
    console.log('Creating new Expo');
    await page.locator('#scrollbarWrapper').getByText('Expos').click();
    
    await page.waitForTimeout(5000);
    // Check if "Create your first Expo!" text exists, if not using another button
    const createFirstExpoText = await page.getByText('Create your first Expo!').count();

    if (createFirstExpoText > 0) {
      console.log('Found "Create your first Expo!" text');
      await page.getByRole('button', { name: 'Create' }).first().click();
    } else {
      console.log('No "Create your first Expo!" text found, looking for Create Expo button');
      await page.getByRole('button', { name: 'Create Expo' }).first().click();
    }

    // Wait for the modal to appear and click on the "Create Expo" text
    await page.locator('#pageContentContainer span').filter({ hasText: 'Create Expo' }).click();

    const currentDate = new Date();
    const formattedDate = `${currentDate.toISOString().slice(0, 19).replace('T', ' ')}.${currentDate.getMilliseconds().toString().padStart(3, '0')}`;
    const expoName = `This is a test expo ${formattedDate}`;
    await page.locator('#pageContentContainer #title').click();
    await page.locator('#pageContentContainer #title').fill(expoName);
    await page.locator('#pageContentContainer form').getByRole('button', { name: 'Create' }).click();

    await expect(page.locator('text="Expo successfully created"')).toBeVisible({ timeout: 10000 });
    console.log(`Expo "${expoName}" created successfully`);

    await page.waitForTimeout(5000);
  });




/*-------------------------------------------------------------------------------------------------

This is a temp step to skip long steps and jump to the end of the test if necessary

await test.step('Temp step - open expo', async () => {
    await page.getByText('Expos').click();
    await page.getByText('This is a test expo').first().click();
});

-------------------------------------------------------------------------------------------------
*/


// Here are 3 different steps related to adding videos to Expo. These made separate because I feel that part of UI will be refactored.
// Also there are different locators for each step and a little different drag and drop ways.
// Note, Expo UI loads kind of slow.

  await test.step('Drag and drop first video to Expo', async () => {
    console.log(`Going to drag and drop first video to Expo`);
    
    // Finding the source element (video)  
    const sourceElement = page.locator('div').filter({ hasText: /^sample_video\.MOV$/ }).nth(1);

    // Finding the target element (folder we just created)
    const targetElement = page.locator('#empty-state');

    // Ensuring that both elements are visible and accessible
    await expect(sourceElement).toBeVisible({timeout: 10000});
    await expect(targetElement).toBeVisible({timeout: 10000});

    /*
    // Add visual indicator before starting drag and drop
    await page.evaluate(() => {
      const indicator = document.createElement('div');
      indicator.id = 'drag-indicator';
      indicator.style.position = 'absolute';
      indicator.style.width = '10px';
      indicator.style.height = '10px';
      indicator.style.backgroundColor = 'red';
      indicator.style.borderRadius = '50%';
      indicator.style.pointerEvents = 'none';
      indicator.style.zIndex = '9999';
      document.body.appendChild(indicator);
    });

    */
    // Get coordinates of source element
    const sourceBoundingBox = await sourceElement.boundingBox();
    const sourceX = sourceBoundingBox.x + sourceBoundingBox.width / 2;
    const sourceY = sourceBoundingBox.y + sourceBoundingBox.height / 2;

    // Get coordinates of target element
    const targetBoundingBox = await targetElement.boundingBox();
    const targetX = targetBoundingBox.x + targetBoundingBox.width / 2;
    const targetY = targetBoundingBox.y + targetBoundingBox.height / 2;

    // Perform drag and drop
    await page.mouse.move(sourceX, sourceY);
    await page.mouse.down();
    await page.mouse.move(targetX, targetY);
    await page.mouse.up();

    console.log('Drag and drop of the first video to Expo completed');

    // Waiting a bit to complete the operation
    await page.waitForTimeout(2000);
  });
   


  await test.step('Drag and drop second video to Expo', async () => {
    console.log('Dragging and dropping second video to Expo');
    
    const sourceElement = page.locator('div').filter({ hasText: /^sample_video2\.MOV$/ }).nth(1);
    const targetElement = page.locator('div[data-id^="no_section"]').first();
    
    // Increase timeout and add retry logic
    await expect(sourceElement).toBeVisible({timeout: 30000});
    await expect(targetElement).toBeVisible({timeout: 30000});
    
    // Function to get bounding box with retry
    const getBoundingBoxWithRetry = async (element, maxRetries = 3) => {
      for (let i = 0; i < maxRetries; i++) {
        const box = await element.boundingBox();
        if (box) return box;
        await page.waitForTimeout(1000);
      }
      throw new Error('Failed to get bounding box after retries');
    };
  
    const sourceBoundingBox = await getBoundingBoxWithRetry(sourceElement);
    const targetBoundingBox = await getBoundingBoxWithRetry(targetElement);
    
    const sourceCenter = {
      x: sourceBoundingBox.x + sourceBoundingBox.width / 2,
      y: sourceBoundingBox.y + sourceBoundingBox.height / 2
    };
    
  
    const targetX = targetBoundingBox.x + (targetBoundingBox.width * 0.25);
    const targetY = targetBoundingBox.y + targetBoundingBox.height + 10;
    
    const performDragAndDrop = async () => {
      await page.mouse.move(sourceCenter.x, sourceCenter.y - 30);
      await page.waitForTimeout(500);
      await page.mouse.down();
      await page.waitForTimeout(500);
  
      const steps = 10; // Increase number of steps for smoother movement
      for (let i = 0; i <= steps; i++) {
        const x = sourceCenter.x + (targetX - sourceCenter.x) * (i / steps);
        const y = sourceCenter.y + (targetY - sourceCenter.y) * (i / steps);
        await page.mouse.move(x, y);
        await page.waitForTimeout(50); // Reduce wait time between steps
  
      }
      
      await page.waitForTimeout(500);
      await page.mouse.up();
    };
  
    try {
      await performDragAndDrop();
      console.log('Drag and drop of the second video to Expo completed');
  
      // Validate with retry logic
      const validateAddition = async () => {
        await page.waitForTimeout(1000); // Дать время на обновление интерфейса

        const secondVideoAdded = await page.locator('#expoContentWrapper .sc-gEvEer')
          .filter({ hasText: 'sample_video2.MOV' })
          .first()
          .isVisible();
        
        if (secondVideoAdded) {
          console.log('Second video successfully added to Expo');
          return true;
        }
        
        console.log('Second video not found in Expo. Checking for other indicators...');
        const videoCount = await page.locator('#expoContentWrapper div[data-testid="video-item"]').count();
        console.log(`Number of videos in Expo: ${videoCount}`);
        return videoCount >= 2;
      };

      const isAdded = await validateAddition();
      if (!isAdded) {
        throw new Error('Failed to add second video to Expo');
      }
    } catch (error) {
      console.error('Error during drag and drop:', error);
      throw error; // Re-throw the error to fail the test
    } finally {

    }
  
    await page.waitForTimeout(2000);
  });

// Adding section to the expo
  await test.step('Add section to the Expo', async () => {
    console.log('Adding section to the Expo');
    await page.getByRole('button', { name: 'Add section' }).click();
    await page.getByRole('textbox', { name: 'Section title' }).fill('This is a test expo section');
    await page.locator('#expoContentWrapper form').getByRole('button', { name: 'Add section' }).click();
    await expect(page.getByText('Expo updated')).toBeVisible(20000);
    
  });

// This is ridiculous, but for sections there is another locator and way to move the video.
// If you think that video should be moved to "Add content" playsholder - you are wrong. 
// It should be dropped below that playsholder. Left visual indicators on the page to demonstrate.
// Created ticket for that DC-9493
await page.waitForTimeout(5000);
  console.log('Preparing to move video to section');
  
  await test.step('Delete one of the video from main Expo to move it to the section', async () => {
    console.log('Deleting video from main Expo to move it to the section');
    // Decided to delete one of videos from the main expo just not to upload 3rd video sample and save time and resources
    // Weird, but then I removed unnecessary validation at the end of second drag and drop step then this step stop working.
    // So returned that validation back. Have no time to investigate it now.
    await page.locator('div').filter({ hasText: /^sample_video\.MOVsample_video2\.MOV$/ }).locator('path').nth(3).click();
    console.log('sample_video2.MOV deleted from main Expo and should be available to add to Section');
  });


// See notes above if you think that video should be moved to "Add content" playsholder.
await test.step('Drag and drop video to the section', async () => {
  console.log('Dragging and dropping video to section');

  await page.pause();

  const sourceElement = page.locator('div').filter({ hasText: /^sample_video2\.MOV$/ }).nth(1);
  const addContentButton = page.locator('div[id$="AddContentButton"]');
  const targetElement = await addContentButton.evaluate(el => {
    const rect = el.getBoundingClientRect();
    return {
      x: rect.left,
      y: rect.bottom + 10,
      width: rect.width,
      height: 50 // estimated height of target area
    };
  });
  
  await expect(sourceElement).toBeVisible();
  await expect(addContentButton).toBeVisible({timeout: 5000});
  
  // Add visual indicators to demo where it should be actually dragged
  await page.evaluate(() => {
    const addIndicator = (id, color) => {
      const indicator = document.createElement('div');
      indicator.id = id;
      indicator.style.position = 'absolute';
      indicator.style.width = '10px';
      indicator.style.height = '10px';
      indicator.style.backgroundColor = color;
      indicator.style.borderRadius = '50%';
      indicator.style.pointerEvents = 'none';
      indicator.style.zIndex = '9999';
      document.body.appendChild(indicator);
    };
    addIndicator('source-indicator', 'red');
    addIndicator('target-indicator', 'blue');
    addIndicator('mouse-indicator', 'green');
  });

  const sourceBoundingBox = await sourceElement.boundingBox();
  
  // Update indicator positions
  const updateIndicators = async (sourceX, sourceY, targetX, targetY, mouseX, mouseY) => {
    await page.evaluate(({ sourceX, sourceY, targetX, targetY, mouseX, mouseY }) => {
      const updateIndicator = (id, x, y) => {
        const indicator = document.getElementById(id);
        indicator.style.left = `${x}px`;
        indicator.style.top = `${y}px`;
      };
      updateIndicator('source-indicator', sourceX, sourceY);
      updateIndicator('target-indicator', targetX, targetY);
      updateIndicator('mouse-indicator', mouseX, mouseY);
    }, { sourceX, sourceY, targetX, targetY, mouseX, mouseY });
  };

  // Calculate coordinates of targetElement center
  const targetX = targetElement.x + targetElement.width / 2;
  const targetY = targetElement.y + targetElement.height / 2;
  
  try {
    // Move mouse to center of source element
    const sourceX = sourceBoundingBox.x + sourceBoundingBox.width / 2;
    const sourceY = sourceBoundingBox.y + sourceBoundingBox.height / 2;
    await page.mouse.move(sourceX, sourceY);
    await updateIndicators(sourceX, sourceY, targetX, targetY, sourceX, sourceY);
    await page.waitForTimeout(1000);

    await page.mouse.down();
    await page.waitForTimeout(500);

    // Move cursor to target element
    for (let i = 0; i <= 10; i++) {
      const x = sourceX + (targetX - sourceX) * (i / 10);
      const y = sourceY + (targetY - sourceY) * (i / 10);
      await page.mouse.move(x, y);
      await updateIndicators(sourceX, sourceY, targetX, targetY, x, y);
      await page.waitForTimeout(300);
    }

    await page.waitForTimeout(500);
    await page.mouse.up();
    console.log('Drag and drop completed');

    // Check if drag and drop was successful
    await expect(page.getByText('Expo updated')).toBeVisible(15000); // This probably enough to check for the update

    // Validate that video is actually added to the section
    const videoInSection = await page.locator('div').filter({ hasText: /^sample_video2\.MOV$/ }).first().isVisible();
    if (videoInSection) {
      console.log('Video successfully added to the section');
    } else {
      throw new Error('Failed to add video to the section');
    }

      } catch (error) {
        console.error('Error during drag and drop:', error);
        throw error;
      } finally {
        // Remove visual indicators
        await page.evaluate(() => {
          ['source-indicator', 'target-indicator', 'mouse-indicator'].forEach(id => {
            const indicator = document.getElementById(id);
            if (indicator) indicator.remove();
          });
        });
      }

      await page.waitForTimeout(2000);
  });

// Test is self-explanatory - adding SEO settings and validating that they are visible in preview
// in the future I would suggest to check that EXPO page is really use these in the header. Now it's not emplemented and not even planned.
await test.step('SEO settings', async () => {
  console.log('Going to validate that SEO settings and its preview are working');

  await page.getByText('SEO').click();
  await page.locator('#pageContentContainer form div').filter({ hasText: 'SEO enabled' }).locator('label').click();
  console.log('Clicking on SEO enabled toggle');
  await page.locator('input[name="seoTitle"]').fill('This is a SEO Title for EXPO');
  await page.locator('textarea[name="seoDescription"]').fill('This is a SEO description for Expo');
  console.log('Filling in SEO title and description');
  await page.getByText('SEO', { exact: true }).first().click();
  console.log('Clicking on SEO just to make sure it is saved');
  await expect(page.getByText('Changes have been saved')).toBeVisible({timeout: 50000});
  console.log('Validating that changes have been saved');
  await expect(page.getByText('This is a SEO Title for EXPO')).toBeVisible(1000);
  await expect(page.getByText('This is a SEO description for Expo')).toBeVisible(1000);
  console.log('Validating that SEO title and description are visible in preview section');

  });

/*
// Editor is not not working as expected. I would suggest to disable this test and probably have a separate suite for Editor.
// Ticket for Editor DC-9490
await test.step('Validate Expo Editor', async () => {

  console.log('Going to validate that Expo Editor is working');
  //await expect(page.getByText('Editor')).toBeVisible({timeout: 10000});
  await page.getByText('Editor').first().click();
  
  await page.getByText('Header').click();
  await page.getByText('Title', { exact: true }).click();
  await page.getByRole('textbox').first().fill('This is a test Expo Title (not SEO)');
  console.log('Filled in the Title');
  await page.getByRole('textbox').nth(1).click();
  await page.getByRole('textbox').nth(1).fill('This is a test Expo Description (not SEO)');
  console.log('Filled in the Description');

  // Select the file input element
  const fileInput = await page.locator('#expo-logodragAndDrop input[type="file"]');

  // Set the file to upload
  await fileInput.setInputFiles('sample_logo.png');

  await page.waitForTimeout(5000);
  // await expect(page.getByText('File uploaded')).toBeVisible({timeout: 10000});
  // console.log('Got File uploaded message');
  await expect(page.frameLocator('#root iframe').locator('img[style="object-fit: cover; width: 250px; max-width: 250px; height: 100%;"]')).toBeVisible({timeout: 10000});
  console.log('Validated logo in the header');

  await page.getByText('Save').first().click();
  // await expect(page.getByText('Changes have been saved')).toBeVisible({timeout: 10000});
  // console.log('Got Changes have been saved message');
  await page.waitForTimeout(15000);
  await page.getByText('Exit').first().click();
  console.log('Clicked on Exit button');
  await page.waitForTimeout(5000);
  try {
    await expect(page.getByText('Discard')).toBeVisible({timeout: 10000});
    console.log('Discard button is visible');
    await page.getByText('Discard').first().click();
  } catch (error) {
    console.log('Discard button did not appear, continuing after 1 seconds');
    await page.waitForTimeout(1000);
  }

  await page.getByText('Editor').first().click();
  console.log('Going back to editor to delete the logo and check sharing link');
  await page.getByText('Header').first().click();
  console.log('Clicking on Header tab');
    
// --------- This needs to be fixed when DC-9490 fixed -------------  
  for (let attempt = 0; attempt < 3; attempt++) {
    const firstTextbox = page.getByRole('textbox').first();
    const secondTextbox = page.getByRole('textbox').nth(1);

    const firstTextboxContent = await firstTextbox.inputValue();
    const secondTextboxContent = await secondTextbox.inputValue();

    if (firstTextboxContent.trim() !== '' && secondTextboxContent.trim() !== '') {
      console.log('Both textboxes are not empty');
      break;
    }

    console.log(`Attempt ${attempt + 1}: One or both textboxes are empty. Refreshing...`);
    await page.locator('div:nth-child(2) > div > div > .pointer').first().click();
    await page.waitForTimeout(5000);
    await page.getByText('Header').first().click();
    await page.waitForTimeout(5000);

    if (attempt === 2) {
      console.log('Failed to populate textboxes after 3 attempts');
      throw new Error('Textboxes remained empty after 3 refresh attempts');
    }
  }
  
// ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  await page.waitForTimeout(5000);
  // Delete the logo
  await page.locator('#expo-logodragAndDrop').getByRole('img').nth(1).click();
  // Probably unnecesary
  await expect(page.frameLocator('#root iframe').locator('img[style="object-fit: cover; width: 250px; max-width: 250px; height: 100%;"]')).not.toBeVisible({timeout: 10000});

  await page.waitForTimeout(5000);
    
  });
*/


await test.step('Check Sharing button', async () => {

  await page.getByText('Editor').first().click();
  await page.getByText('Header').click();
  await page.getByRole('button', { name: 'Sharing' }).click();
  await page.getByText('Share Link').click();
  await expect(page.getByText('Copied to clipboard')).toBeVisible({timeout: 15000});
  const clipboardContent = await clipboardy.default.read();

  // Check if the copied link starts with 'https://dacastexpo.com?id='
  expect(clipboardContent).toMatch(/^https:\/\/dacastexpo\.com\?id=.+$/);
  console.log('Copied share link:', clipboardContent);

  // Go to the link
  await page.goto(clipboardContent);
  console.log('Going to the link from clipboard');
  
  // Wait for the page to load
  await page.waitForLoadState('networkidle');
  console.log('Page is loaded');
  await page.waitForTimeout(5000);

  const expoTitleLocator = page.locator('h1:has-text("This is a test expo")');
  await expect(expoTitleLocator).toBeVisible({ timeout: 20000 });
  console.log('Title of the Expo is visible');

  // Suggestions:
  // 1. Validate that header is visible and contains correct title, description and logo
  // 2. Validate video playback (in the main expo and in the section)
    await page.waitForTimeout(2000);

  console.log('Expos test completed');

});
});
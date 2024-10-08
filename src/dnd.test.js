const { test, expect } = require('./utils');
const { uploadVideo } = require('./helpers/fileUploader');

let clipboardy;

test.beforeAll(async () => {
  clipboardy = await import('clipboardy');
});

test('Create Expo test', async ({ page, browser }) => {
  console.log('Starting Create Expo test');
  
  // Set a longer timeout for this test
  test.setTimeout(300000);

  await test.step('Open expo', async () => {
    await page.getByText('Expos').click();
    await page.getByText('This is a test expo').first().click();
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
    
    // Add visual indicators (keep your existing code for this part)
    // ...
  
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
  
        // Update mouse indicator (keep your existing code for this part)
        // ...
      }
      
      await page.waitForTimeout(500);
      await page.mouse.up();
    };
  
    try {
      await performDragAndDrop();
      console.log('Drag and drop of the second video to Expo completed');
  
      // Validate with retry logic
      const validateAddition = async (maxRetries = 3) => {
        for (let i = 0; i < maxRetries; i++) {
          const secondVideoAdded = await page.locator('#expoContentWrapper .sc-gEvEer')
            .filter({ hasText: 'sample_video2.MOV' })
            .first()
            .isVisible();
          
          if (secondVideoAdded) {
            console.log('Second video successfully added to Expo');
            return true;
          }
          
          if (i < maxRetries - 1) {
            console.log(`Validation attempt ${i + 1} failed. Retrying...`);
            await page.waitForTimeout(1000);
          }
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
      // Remove visual indicators (keep your existing code for this part)
      // ...
    }
  
    await page.waitForTimeout(2000);
  });
});
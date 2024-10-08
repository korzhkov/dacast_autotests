const { test, expect } = require('./utils');
const { uploadVideo } = require('./helpers/fileUploader');
const { timeout } = require('../playwright.config');

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

  await test.step('Drag and drop video to the section', async () => {
    console.log('Dragging and dropping video to section');

    const sourceElement = page.locator('div').filter({ hasText: /^sample_video2\.MOV$/ }).nth(1);
    const addContentButton = page.locator('div[id$="AddContentButton"]');
    
    // Increase timeout and add retry logic
    await expect(sourceElement).toBeVisible({timeout: 30000});
    await expect(addContentButton).toBeVisible({timeout: 30000});
    
    
    // This function is used to reliably get the bounding box of an element
    // It attempts to get the bounding box multiple times in case of initial failure
    // This is useful for elements that might not be immediately available or fully rendered
    const getBoundingBoxWithRetry = async (element, maxRetries = 3) => {
      for (let i = 0; i < maxRetries; i++) {
        const box = await element.boundingBox();
        if (box) return box;
        await page.waitForTimeout(1000);
      }
      throw new Error('Failed to get bounding box after retries');
    };
  
    const sourceBoundingBox = await getBoundingBoxWithRetry(sourceElement);
    const addContentButtonBox = await getBoundingBoxWithRetry(addContentButton);
    
    const sourceCenter = {
      x: sourceBoundingBox.x + sourceBoundingBox.width / 2,
      y: sourceBoundingBox.y + sourceBoundingBox.height / 2
    };
    
    const targetX = addContentButtonBox.x + addContentButtonBox.width / 2;
    const targetY = addContentButtonBox.y + addContentButtonBox.height + 10;
    
    const performDragAndDrop = async () => {
      // - 30px to drag for image, not for text - very important!
      await page.mouse.move(sourceCenter.x, sourceCenter.y - 30);
      await page.waitForTimeout(500);
      await page.mouse.down();
      await page.waitForTimeout(500);
  
      const steps = 10;
      for (let i = 0; i <= steps; i++) {
        const x = sourceCenter.x + (targetX - sourceCenter.x) * (i / steps);
        const y = (sourceCenter.y - 30) + (targetY - (sourceCenter.y - 30)) * (i / steps);
        await page.mouse.move(x, y);
        await page.waitForTimeout(50); // Time to move the mouse
      }
      
      await page.waitForTimeout(500);
      await page.mouse.up();
    };
  
    try {
      await performDragAndDrop();
      console.log('Drag and drop of the video to section completed');
  
      await page.waitForTimeout(2000);
  
      // Validate that video is actually added to the section
      const videoInSection = await page.getByText('sample_video2.MOV Add content').isVisible({ timeout: 10000 });
  
      if (videoInSection) {
        console.log('Video successfully added to the section');
      } else {
        throw new Error('Video not found in the section after drag and drop');
      }
    } catch (error) {
      console.error('Error during drag and drop to section:', error);
      throw error; // Re-throw the error to fail the test
    }
  
    await page.waitForTimeout(2000);
  });


  

});

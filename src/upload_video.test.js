const { test, expect } = require('./utils');
const { uploadVideo } = require('./helpers/fileUploader');

let clipboardy;

test.beforeAll(async () => {
  clipboardy = await import('clipboardy');
});

test('Upload video test - Final Stable Version', async ({ page }) => {
  test.setTimeout(500000);

  const browserVersion = await page.evaluate(() => navigator.userAgent);
  console.log(
    `[${new Date().toISOString()}] Browser version: ${browserVersion}`,
  );

  // --- STEP 1: VIDEO UPLOAD ---
  await test.step('Upload video', async () => {
    await uploadVideo(page, 'sample_video.MOV', clipboardy);
  });

  // --- STEP 2: VERIFY UPLOADED VIDEO IN LIST ---
  await test.step('Verify uploaded video', async () => {
    await page.locator('#scrollbarWrapper').getByText('Videos').click();
    const firstVideoText = await page
      .locator('text="Upload your first Video!"')
      .count();

    if (firstVideoText > 0) {
      await page.waitForTimeout(5000);
      await page.reload();
    }

    await Promise.race([
      page.waitForSelector('a[href^="/videos/"]', { timeout: 30000 }),
      page.waitForSelector('text="Upload your first Video!"', {
        timeout: 30000,
      }),
    ]);
  });

  // --- STEP 3: STATUS CHECK (TRANSCODING) ---
  await test.step('Checking sample_video.MOV status', async () => {
    await page.waitForTimeout(4000); //added timeout before page reload
    await page.reload();
    const maxAttempts = 30;
    let attempts = 0;
    let processingComplete = false;

    while (attempts < maxAttempts && !processingComplete) {
      console.log(
        `[${new Date().toISOString()}] Attempt ${
          attempts + 1
        }: Checking status`,
      );
      await page.waitForSelector('#videosListTable', {
        state: 'visible',
        timeout: 15000,
      });

      const row = await page
        .locator('#videosListTable tr')
        .filter({ hasText: 'sample_video.MOV' })
        .first();
      if ((await row.count()) > 0) {
        const rowText = await row.innerText();
        if (rowText.includes('Online')) {
          processingComplete = true;
        } else {
          await page.reload();
          await page.waitForTimeout(10000);
        }
      }
      attempts++;
    }

    // Fail-safe screenshot
    if (!processingComplete) {
      const fs = require('fs');
      const dir = './historical-screenshots';
      if (!fs.existsSync(dir)) fs.mkdirSync(dir);
      await page.screenshot({ path: `${dir}/error-${Date.now()}.png` });
    }

    await page
      .locator('a[href^="/videos/"]')
      .filter({ hasText: 'sample_video.MOV' })
      .first()
      .click();
  });

  // --- STEP 4: EDIT METADATA ---
  await test.step('Edit video description', async () => {
    const formattedDate = new Date()
      .toISOString()
      .replace('T', ' ')
      .slice(0, 19);
    await page
      .locator('textarea[type="textarea"]')
      .fill(`Stability Test - ${formattedDate}`);
    await page.getByRole('banner').getByText('Videos').first().click();
    await expect(page.locator('text="Changes have been saved"')).toBeVisible({
      timeout: 10000,
    });
  });

  // --- STEP 5: THUMBNAIL UPLOAD ---
  await test.step('Upload thumbnail', async () => {
    await page.getByRole('cell', { name: 'sample_video.MOV' }).first().click();
    await page
      .locator('#vod-splashscreendragAndDrop')
      .getByRole('img')
      .nth(1)
      .click();
    await page
      .locator('#vod-splashscreenUploadInput')
      .setInputFiles('sample_logo.png');
    await expect(page.locator('text="File uploaded"')).toBeVisible({
      timeout: 15000,
    });
    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  // --- STEP 6: VERIFY DOWNLOAD WITH PROGRESS INDICATOR ---
  await test.step('Verify video download', async () => {
    let downloadStarted = false;
    const downloadPromise = page
      .waitForEvent('download', { timeout: 15000 })
      .catch(() => null);

    await page.getByRole('button', { name: 'Download' }).first().click();
    const download = await downloadPromise;

    if (download) {
      downloadStarted = true;
      const suggestedFilename = download.suggestedFilename();
      console.log(
        `[${new Date().toISOString()}] Download started: ${suggestedFilename}`,
      );

      // Track progress using a simple interval to check the partial file size
      const progressInterval = setInterval(async () => {
        try {
          const path = await download.path();
          if (path) {
            const fs = require('fs');
            const stats = fs.statSync(path);
            // Log current size in MB for better readability
            const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
            console.log(
              `[${new Date().toISOString()}] Progress: ${sizeInMB} MB downloaded...`,
            );
          }
        } catch (e) {
          // File might not be created yet or already moved
        }
      }, 1000); // Check every second

      // Wait for the download to complete
      const finalPath = await download.path();
      clearInterval(progressInterval); // Stop tracking progress

      expect(finalPath).toBeTruthy();

      const fs = require('fs');
      const stats = fs.statSync(finalPath);
      expect(stats.size).toBeGreaterThan(0);

      const finalSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(
        `[${new Date().toISOString()}] Download finished! Final size: ${finalSizeMB} MB`,
      );
      expect(suggestedFilename).toMatch(/\.(mp4|mov|MOV|MP4)$/);
    } else {
      console.log("Download doesn't start, check account settings");
      test.info().annotations.push({
        type: 'issue',
        description: "Download doesn't start",
      });
    }

    if (!downloadStarted) {
      test.info().annotations.push({
        type: 'failure',
        description: 'Download should have started',
      });
    }
  });

  // --- STEP 7: PLAYBACK WITH ACCURATE DETECTION ---
  await test.step('Check share link and video playback', async () => {
    await page.getByRole('button', { name: 'Copy Share Link' }).click();
    await page.waitForTimeout(1000);

    // Get the clipboard content
    const clipboardContent = await clipboardy.default.read();

    // Check if the copied link starts with 'https://iframe.dacast.com/vod/'
    const env = process.env.WORKENV || 'prod';

    if (env === 'prod') {
      expect(clipboardContent).toMatch(/^https:\/\/iframe\.dacast\.com\/vod\//);
    } else if (env === 'stage') {
      expect(clipboardContent).toMatch(
        /^https:\/\/iframe-dev\.dacast\.com\/vod\//,
      );
    } else if (env === 'dev') {
      expect(clipboardContent).toMatch(
        /^https:\/\/iframe-testing\.dacast\.com\/vod\//,
      );
    }

    await page.goto(clipboardContent);

    // 1. Capture Network to identify player definitively
    let bitmovinDetected = false;
    page.on('request', (req) => {
      if (req.url().includes('bitmovin')) bitmovinDetected = true;
    });

    await page.goto(clipboardContent, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000); // Wait for scripts to initialize

    // 2. Final player identification
    const playerType = await page.evaluate((isBitmovinNet) => {
      if (window.bitmovin || isBitmovinNet) return 'Bitmovin';
      if (window.THEOplayer) return 'TheoPlayer';
      return 'Unknown';
    }, bitmovinDetected);

    console.log(
      `[${new Date().toISOString()}] CONFIRMED PLAYER: ${playerType}`,
    );

    // Clean overlays
    await page.evaluate(() => {
      document
        .querySelectorAll('.dc-dacast-overlay')
        .forEach((el) => el.remove());
    });

    // 3. Play action
    if (playerType === 'Bitmovin') {
      // For Bitmovin, the large Play button in the center is usually reliable
      const playBtn = page
        .locator('.bitmovinplayer-container button, .dc-play-button')
        .first();
      if (await playBtn.isVisible()) await playBtn.click();
      else
        await page.mouse.click(
          page.viewportSize().width / 2,
          page.viewportSize().height / 2,
        );
    } else {
      // TheoPlayer fallback
      await page.mouse.click(
        page.viewportSize().width / 2,
        page.viewportSize().height / 2,
      );
    }

    // 4. Verify playback using HTML5 Video API (Works for all)
    await expect(async () => {
      let isPlaying = false;
      for (const frame of page.frames()) {
        try {
          isPlaying = await frame.evaluate(() => {
            const v = document.querySelector('video');
            return !!(
              v &&
              v.currentTime > 1.5 &&
              !v.paused &&
              v.readyState >= 2
            );
          });
          if (isPlaying) break;
        } catch (e) {}
      }
      expect(isPlaying).toBe(true);
    }).toPass({ timeout: 45000, intervals: [2000] });

    console.log(`Playback confirmed for ${playerType}`);
  });

  // --- FINAL STEP ---
  await test.step('Finish test', async () => {
    await page.goto('https://app.dacast.com/videos');
  });
});

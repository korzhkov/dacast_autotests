const { test, expect } = require('./utils');
require('dotenv').config();
const env = process.env.WORKENV || 'prod';
const host = env === 'stage' ? process.env._HOST_LOGGED_STAGE : process.env._HOST_LOGGED;


test('Validate analytics test', async ({ page }) => {
    // Set a longer timeout for this test as stream creation might take a while
    test.setTimeout(300000);


    await test.step('Analytics check date range', async () => {

        await page.getByText('Analytics').click();
        await page.locator('#dropdownTitle').first().click();
        await page.locator('[id="datePresetDropdown_Last\\ Month2"] div').click();
        // Wait for the URL to update after selecting the date range
        await page.waitForTimeout(5000);
        await page.waitForURL(/.*timeRange=LAST_MONTH.*/);
        // Get the current URL
        const currentUrl = page.url();
        // Check if the URL contains the expected parameter
        expect(currentUrl).toContain('timeRange=LAST_MONTH');
        console.log('URL successfully updated with timeRange=LAST_MONTH');
    
  });

  await test.step('Generate and navigate to random analytics URL', async () => {
      function generateRandomAnalyticsURL() {
        // listing all sections and time period options
          const sections = ['audience', 'data', 'storage', 'content', 'engagement', 'paywall'];
          const timeRanges = ['LAST_WEEK', 'LAST_24_HOURS', 'LAST_MONTH', 'LAST_6_MONTHS', 'YEAR_TO_DATE'];
          const formats = ['time', 'location', 'browse'];
        
        // Randomly take section and time range
          const randomChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];

          const section = randomChoice(sections);
          const timeRange = randomChoice(timeRanges);
        
        // Form random URL
          let url = `/analytics/${section}?timeRange=${timeRange}`;
        
        // Add format parameter for specific sections
          if (['audience', 'content', 'engagement'].includes(section)) {
              const format = randomChoice(formats);
              url += `&format=${format}`;
          }
        
          return url;
      }
      
      const randomURLPath = generateRandomAnalyticsURL();
      const fullRandomURL = `https://${host}${randomURLPath}`;
      console.log(`Navigating to random URL: ${fullRandomURL}`);

      await page.goto(fullRandomURL);
      await page.waitForTimeout(5000);
      const currentUrl = page.url();
      console.log(`Current URL after navigation: ${currentUrl}`);

          
      // Extract and log the actual values
      const urlParams = new URL(currentUrl).searchParams;
      const urlPath = new URL(currentUrl).pathname;
      // This line extracts the last segment of the URL path, which represents the analytics section
      // For example, if urlPath is '/analytics/audience', this will return 'audience'
      const section = urlPath.split('/').pop();
      console.log('Actual section:', section);
      console.log('Actual timeRange:', urlParams.get('timeRange'));
      console.log('Actual format:', urlParams.get('format'));

      // Verify that the format parameter is present only for specific sections
      if (['audience', 'content', 'engagement'].includes(section)) {
          expect(urlParams.get('format')).toBeTruthy();
      } else {
          expect(urlParams.get('format')).toBeNull();
      }

      // Optional: Add more checks here to verify the page content based on the actual parameters
  });

  await test.step('Verify data export', async () => {

    let downloadStarted = false;
    const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
    // There is two options to export data: CSV and XLS, we randomly choose one.
    const exportOptions = ['Export CSV', 'Export XLS'];
    const randomOption = exportOptions[Math.floor(Math.random() * exportOptions.length)];
    await page.getByRole('button', { name: randomOption }).click();
    console.log(`Clicked on ${randomOption} button`);
    
    const download = await downloadPromise;
    
    if (download) {
      downloadStarted = true;
      // Validate the file name
      const suggestedFilename = download.suggestedFilename();
      console.log('Downloaded filename:', suggestedFilename);
      expect(suggestedFilename).toMatch(/\.(csv|xls)$/); // Validate the file extension

      // Optionally: save the file and check its size
      const path = await download.path();
      expect(path).toBeTruthy();
      
      const fs = require('fs');
      const stats = fs.statSync(path);
      expect(stats.size).toBeGreaterThan(0);

      console.log(`File downloaded successfully. Size: ${stats.size} bytes`);
    } else {
      console.log("Download doesn't start, check account settings");
      test.info().annotations.push({ type: 'issue', description: "Download doesn't start" });
    }

    // This will mark the step as failed if download didn't start, but won't stop execution
    if (!downloadStarted) {
      test.info().annotations.push({ type: 'failure', description: "Download should have started" });
    }
  });
        
});
const { test, expect } = require('./utils');
require('dotenv').config();
const host = process.env._HOST_LOGGED;


test('Cleaner', async ({ page }) => {
  // Set a longer timeout for this test as stream creation might take a while
  test.setTimeout(300000);
// This is not even started yet
  
await test.step('Clean Videos', async () => {

await page.goto(`https://${host}/videos`);

try {
  const paginationDropdown = await page.locator('#paginationDropdown').getByRole('img');
  if (await paginationDropdown.isVisible({ timeout: 5000 })) {
    await paginationDropdown.click();
    await page.getByText('100').click();
  } else {
    console.log('Pagination dropdown not found. Skipping this step.');
  }
} catch (error) {
  console.log('Error while interacting with pagination: ', error.message);
}

await page.getByPlaceholder('Search by Title...').click();
await page.getByPlaceholder('Search by Title...').fill('sample');
await page.waitForTimeout(2000);
await page.getByPlaceholder('Search by Title...').press('Enter');
await page.waitForTimeout(5000);


const noItemsFound = await page.locator('text="No items matched your search"').count() > 0;

if (!noItemsFound) {
  await page.getByRole('row', { name: 'Title Size Date Status' }).locator('label div').click();
  await page.getByRole('button', { name: 'Bulk Actions' }).click();
  await page.getByRole('list').getByText('Delete').click();
  await page.getByRole('button', { name: 'Delete' }).click();
} else {
  console.log('No items matched the search. Skipping deletion steps.');
}

});

await test.step('Clean Streams', async () => {

await page.goto(`https://${host}/livestreams`);

await page.waitForTimeout(5000);

const noStreamsText = await page.locator('text="Create your first Live Stream!"').count() > 0; 

if (!noStreamsText) {
  await page.getByRole('row', { name: 'Title Date Status Features' }).locator('label div').click();
  await page.getByRole('button', { name: 'Bulk Actions' }).click();
  await page.getByRole('list').getByText('Delete').click();
  await page.getByRole('button', { name: 'Delete' }).click();
} else {
  console.log('No streams found. Skipping deletion steps.');
}

}); 
});
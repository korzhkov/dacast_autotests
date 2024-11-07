const { test, expect } = require('./utils');
const { getEnvVars } = require('./helpers/envHelper');

// Получаем окружение из параметра командной строки --workenv=xxx
const workenvArg = process.argv.find(arg => arg.startsWith('--workenv='));
const env = workenvArg ? workenvArg.split('=')[1] : (process.env.WORKENV || 'prod');

test('Cleaner', async ({ page }) => {
  const { hostLogged } = getEnvVars(env);
  test.setTimeout(240000);

  console.log(`Running cleaner test in ${env.toUpperCase()} environment`);

  await test.step('Clean Videos', async () => {
    await page.waitForTimeout(5000);
    await page.goto(`https://${hostLogged}/videos?perPage=100`);

    await page.waitForTimeout(5000);

    const noVideosText = await page.locator('text="Upload your first Video!"').count() > 0;
        
    if (!noVideosText) {
      await page.getByPlaceholder('Search by Title...').click();
      await page.getByPlaceholder('Search by Title...').fill('sample');
      await page.waitForTimeout(2000);
      await page.getByPlaceholder('Search by Title...').press('Enter');
      await page.waitForTimeout(5000);
    } else {
      console.log('No videos found. Skipping search steps.');
    }

    if (!noVideosText) {
      const noItemsFound = await page.locator('text="No items matched your search"').count() > 0;

      if (!noItemsFound) {
        await page.getByRole('row', { name: 'Title Date Status Features' }).locator('label div').click();
        await page.getByRole('button', { name: 'Bulk Actions' }).click();
        await page.getByRole('list').getByText('Delete').click();
        await page.getByRole('button', { name: 'Delete' }).click();
        await expect(page.getByText('item(s) deleted')).toBeVisible({timeout: 30000});
      } else {
        console.log('No items matched the search. Skipping deletion steps.');
      }
    } else {
      console.log('No videos found. Skipping deletion steps.');
    }
  });

  await test.step('Clean Streams', async () => {
    await page.waitForTimeout(5000);
    await page.goto(`https://${hostLogged}/livestreams?perPage=100`);

    await page.waitForTimeout(5000);

    const noStreamsText = await page.locator('text="Create your first Live Stream!"').count() > 0;

    if (!noStreamsText) {
      await page.getByPlaceholder('Search by Title...').click();
      await page.getByPlaceholder('Search by Title...').fill('Pre-recorded stream');
      await page.waitForTimeout(2000);
      await page.getByPlaceholder('Search by Title...').press('Enter');
      await page.waitForTimeout(5000);
    } else {
      console.log('No streams found. Skipping search steps.');
    }

    if (!noStreamsText) {
      const noItemsFound = await page.locator('text="No items matched your search"').count() > 0;

      if (!noItemsFound) {
        await page.getByRole('row', { name: 'Title Date Status Features' }).locator('label div').click();
        await page.getByRole('button', { name: 'Bulk Actions' }).click();
        await page.getByRole('list').getByText('Delete').click();
        await page.getByRole('button', { name: 'Delete' }).click();
        await expect(page.getByText('item(s) deleted')).toBeVisible({timeout: 30000});
      } else {
        console.log('No items matched the search. Skipping deletion steps.');
      }
    } else {
      console.log('No streams found. Skipping deletion steps.');
    }
  });

  await test.step('Clean Playlists', async () => {
    //await page.locator('#scrollbarWrapper').getByText('Playlists').click();
    await page.waitForTimeout(5000);
    await page.goto(`https://${hostLogged}/playlists?perPage=100`);

    await page.waitForTimeout(5000);

    const noPlaylistsText = await page.locator('text="Create your first playlist!"').count() > 0;

    if (!noPlaylistsText) {
      await page.getByPlaceholder('Search by Title...').click();
      await page.getByPlaceholder('Search by Title...').fill('This is a test');
      await page.waitForTimeout(2000);
      await page.getByPlaceholder('Search by Title...').press('Enter');
      await page.waitForTimeout(5000);
    } else {
      console.log('No playlists found. Skipping search steps.');
    }


if (!noPlaylistsText) {
  const noItemsFound = await page.locator('text="No items matched your search"').count() > 0;

  if (!noItemsFound) {
    await page.getByRole('row', { name: 'Title Date Status Features' }).locator('label div').click();
    await page.getByRole('button', { name: 'Bulk Actions' }).click();
    await page.getByRole('list').getByText('Delete').click();
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('item(s) deleted')).toBeVisible({timeout: 30000});
  } else {
    console.log('No items matched the search. Skipping deletion steps.');
  }
} else {
  console.log('No playlists found. Skipping deletion steps.');
}
});


await test.step('Clean Schedulers', async () => {
  await page.waitForTimeout(5000);
  await page.goto(`https://${hostLogged}/schedulers?perPage=100`);

  await page.waitForTimeout(5000);

  const noSchedulersText = await page.locator('text="You have no scheduled Live Stream"').count() > 0;

  if (!noSchedulersText) {
    await page.getByPlaceholder('Search by Title...').click();
    await page.getByPlaceholder('Search by Title...').fill('This is a sample schedule');
    await page.waitForTimeout(2000);
    await page.getByPlaceholder('Search by Title...').press('Enter');
    await page.waitForTimeout(5000);
  } else {
    console.log('No schedulers found. Skipping search steps.');
  }

  if (!noSchedulersText) {
    const noItemsFound = await page.locator('text="No items matched your search"').count() > 0;

    if (!noItemsFound) {
      await page.getByRole('row', { name: 'Title Date Status Features' }).locator('label div').click();
      await page.getByRole('button', { name: 'Bulk Actions' }).click();
      await page.getByRole('list').getByText('Delete').click();
      await page.getByRole('button', { name: 'Delete' }).click();
      await expect(page.getByText('item(s) deleted')).toBeVisible({timeout: 30000});
    } else {
      console.log('No items matched the search. Skipping deletion steps.');
    }
  } else {
    console.log('No schedulers found. Skipping deletion steps.');
  }
});


await test.step('Clean Expo', async () => {
  await page.waitForTimeout(5000);
  await page.goto(`https://${hostLogged}/expos?perPage=100`);

  await page.waitForTimeout(5000);

  // Finding all rows in the table and logging the number of rows found
  const rows = await page.locator('tbody > tr').all();
  console.log(`Found ${rows.length} rows`);

  if (rows.length > 0) {
    for (const row of rows) {
      try {
        // Hover over the row to get the delete icon visible
        await row.hover();
        
        // Wait for the delete icon (SVG) to appear
        const deleteIcon = row.locator('svg[viewBox="0 0 24 24"]:has(path[d^="M6 19c0 1.1"])');
        await deleteIcon.waitFor({ state: 'visible', timeout: 5000 });
        
        // Click on the delete icon
        await deleteIcon.click();
        
        // Wait for and click the delete confirmation button in the dialog
        const confirmDeleteButton = page.getByRole('button', { name: 'Delete forever' });
        await confirmDeleteButton.waitFor({ state: 'visible', timeout: 5000 });
        await confirmDeleteButton.click();
        
        await page.waitForTimeout(2000);

        console.log('Successfully deleted an Expo');
      } catch (error) {
        console.error('Error deleting row:', error);
        continue;
      }
    }
    console.log(`Attempted to delete ${rows.length} Expo(s)`);
  } else {
    console.log('No Expos found. Skipping deletion steps.');
  }
});

await test.step('Clean Folders', async () => {
  await page.waitForTimeout(5000);
  await page.goto(`https://${hostLogged}/folders`);

  await page.waitForTimeout(5000);


  const paginationDropdownExists = await page.locator('#paginationDropdown').count() > 0;
  if (paginationDropdownExists) {
    await page.locator('#paginationDropdown').getByRole('img').click();
    await page.locator('body').press('PageDown');
    await page.getByText('100').click();
  } else {
    console.log('Pagination dropdown not found. Skipping pagination steps.');
  }

  await page.waitForTimeout(5000);

  await page.getByPlaceholder('Search by Title...').click();
  await page.getByPlaceholder('Search by Title...').fill('This is a test folder');
  await page.waitForTimeout(2000);
  await page.getByPlaceholder('Search by Title...').press('Enter');
  await page.waitForTimeout(5000);

  const hasSearchResults = await page.locator('div[draggable="true"]').count() > 0;
  const noItemsFound = !hasSearchResults;

  if (!noItemsFound) {
    await page.locator('.flex > .sc-bmzYkS > .sc-dtInlm > .sc-jxOSlx').first().click();
    await page.getByRole('button', { name: 'Bulk Actions' }).click();
    await page.getByRole('list').getByText('Delete').click();
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('item(s) deleted')).toBeVisible({timeout: 30000});
  } else {
    console.log('No items matched the search. Skipping deletion steps.');
  }
});


// This step definitely should go last, as it empties the trash

await test.step('Clean Trash', async () => {
  await page.waitForTimeout(5000);
  await page.goto(`https://${hostLogged}/folders`);

  await page.getByText('Trash', { exact: true }).first().click();
  
  await page.waitForTimeout(5000);

  const paginationDropdownExists = await page.locator('#paginationDropdown').count() > 0;
  if (paginationDropdownExists) {
    await page.locator('#paginationDropdown').getByRole('img').click();
    await page.locator('body').press('PageDown');
    await page.getByText('100').click(); // what if there are more than 100 items?
  } else {
    console.log('Pagination dropdown not found. Skipping pagination steps.');
  }

  await page.waitForTimeout(5000);

  const hasDeletedContent = await page.locator('text="You have no deleted content"').count() > 0;
  
  if (!hasDeletedContent) {
    await page.locator('.flex > .sc-bmzYkS > .sc-dtInlm > .sc-jxOSlx').first().click();
    await page.getByRole('button', { name: 'Empty trash' }).click();
    await page.getByRole('button', { name: 'Empty', exact: true }).click();
    await expect(page.getByText('Your Trash has been emptied')).toBeVisible({timeout: 30000});
  } else {
    console.log('No deleted content found. Skipping deletion steps.');
  }
});


});

async function uploadVideo(page, filename, clipboardy) {
  await page.getByRole('button', { name: 'Add +' }).click();
  await page.locator('#undefined_vod').click();

  const fileInput = await page.$('#browseButton');
  if (!fileInput) {
    throw new Error('File input not found');
  }

  await page.evaluate((el) => { el.style.display = 'block'; }, fileInput);
  await fileInput.setInputFiles(filename);
  await page.evaluate((el) => { el.style.display = 'none'; }, fileInput);

  await page.getByPlaceholder('Search by Title...').fill(filename);

// added extra logging with timestamps to debug the DC-9745; 
  console.log(`[${new Date().toISOString()}] Clicking Upload button`);
  await page.getByRole('button', { name: 'Upload' }).click();
  
  // this added to get the vod-id for DC-9745;
  console.log(`[${new Date().toISOString()}] Clicking Copy share link button`);
  await page.getByText('Copy share link').click();

  console.log(`[${new Date().toISOString()}] Waiting for clipboard update`);
  await page.waitForTimeout(1000);

  console.log(`[${new Date().toISOString()}] Reading clipboard content`);
  const clipboardContent = await clipboardy.default.read();
  console.log(`[${new Date().toISOString()}] Clipboard content: ${clipboardContent}`);

  console.log(`[${new Date().toISOString()}] Clicking Complete button`);
  await page.getByText('Complete', { exact: true }).click();

  
}

module.exports = { uploadVideo };
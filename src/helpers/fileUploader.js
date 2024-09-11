async function uploadVideo(page, filename) {
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
  await page.getByRole('button', { name: 'Upload' }).click();

  await page.getByText('Complete', { exact: true }).click();
}

module.exports = { uploadVideo };
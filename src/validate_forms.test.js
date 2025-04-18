const { test, expect } = require('./utils');

test('Validate forms and reCaptcha test', async ({ page }) => {
  test.setTimeout(180000); // 3 minutes timeout

/*  await test.step('Testing customer success story form', async () => {
    // Навигация на страницу
    console.log('Navigating to customer success story page');
    await page.goto('https://www.dacast.com/customer-success-story-be-featured/', { 
      waitUntil: 'networkidle', 
      timeout: 60000 
    });


    await page.getByPlaceholder('First Name').click();
    await page.getByPlaceholder('First Name').fill('Autotest');
    await page.getByPlaceholder('First Name').press('Tab');
    await page.getByPlaceholder('Last Name').fill('Autotest');
    await page.getByPlaceholder('Last Name').press('Tab');
    await page.getByPlaceholder('Company Name').fill('Autotest');
    await page.getByPlaceholder('Company Name').press('Tab');
    await page.getByPlaceholder('you@company.com').fill('yury@dacast.com');
    await page.getByLabel('You agree to our private').check();
    await page.getByRole('button', { name: 'Get Contacted' }).click();

    await page.waitForTimeout(20000); 

  });

  await test.step('Testing contact form', async () => {
    console.log('Navigating to contact page');
    await page.goto('https://www.dacast.com/contact/', {
      waitUntil: 'networkidle',
      timeout: 60000
    });

    await page.getByLabel('First Name *').click();
    await page.getByLabel('First Name *').fill('Autotest');
    await page.getByLabel('First Name *').press('Tab');
    await page.getByLabel('Last Name *').fill('Autotestov');
    await page.getByLabel('Last Name *').press('Tab');
    await page.getByLabel('Email *', { exact: true }).fill('yuri@dacast.com');
    await page.getByLabel('Phone Number *').click();
    await page.getByLabel('Phone Number *').fill('+351910722488');
    await page.getByLabel('Phone Number *').press('Tab');
    await page.getByText('support@dacast.comRemove item').click();
    await page.locator('#choices--wpforms-338727-field_6-item-choice-2').click();
    await page.getByLabel('Message').click();
    await page.getByLabel('Message').fill('This is a test message from autotest');
    await page.getByRole('button', { name: 'Submit' }).click();

    await page.waitForTimeout(20000);
  });
 */
  await test.step('Testing book a demo form', async () => {
    console.log('Navigating to book a demo page');
    await page.goto('https://www.dacast.com/book-a-demo/', {
      waitUntil: 'networkidle', 
      timeout: 60000
    });

    await page.getByLabel('First Name *').click();
    await page.getByLabel('First Name *').fill('Autotest');
    await page.getByLabel('First Name *').press('Tab');
    await page.getByLabel('Last Name *').fill('Autotestov');
    await page.getByLabel('Last Name *').press('Tab');
    await page.getByLabel('Email *').fill('yuri@dacast.com');
    await page.getByLabel('Email *').press('Tab');
    await page.getByLabel('Company Website URL *').fill('encoding.com');
    await page.getByLabel('Company Website URL *').press('Tab');
    await page.getByLabel('Phone Number *').fill('+351910722488');
    await page.getByLabel('Phone Number *').press('Tab');
    await page.getByText('Choose industryRemove item').click();
    await page.getByRole('option', { name: 'Media + Entertainment' }).click();
    await page.getByText('Choose descriptionRemove item').click();
    await page.getByRole('option', { name: 'Both' }).click();
    await page.getByRole('button', { name: 'Request a Demo' }).click();

    await page.waitForTimeout(20000);
  });
});

const { test, expect } = require('@playwright/test');
require('dotenv').config();

// Lists of first names and last names
const firstNames = [
  'John', 'Alice', 'Michael', 'Emma', 'David', 'Olivia', 'William', 'Sophia', 'James', 'Ava',
  'Mohammed', 'Yuki', 'Wei', 'Maria', 'Juan', 'Fatima', 'Ivan', 'Aisha', 'Chen', 'Sven',
  'Priya', 'Hiroshi', 'Olga', 'Ahmed', 'Ingrid', 'Carlos', 'Mei', 'Hans', 'Amelia', 'Raj',
  'Liam', 'Zoe', 'Mateo', 'Chloe', 'Noah', 'Sofia', 'Ethan', 'Mia', 'Oliver', 'Charlotte',
  'Muhammad', 'Emily', 'Aarav', 'Isabella', 'Alexander', 'Sophie', 'Daniel', 'Evelyn', 'Lucas', 'Harper'
];
const lastNames = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Kim', 'Lee', 'Wang', 'Zhang', 'Chen', 'Nguyen', 'Patel', 'Singh', 'Kumar', 'Müller',
  'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Schulz', 'Hoffmann', 'Schäfer',
  'Sato', 'Suzuki', 'Takahashi', 'Tanaka', 'Watanabe', 'Ito', 'Yamamoto', 'Nakamura', 'Kobayashi', 'Kato',
  'Silva', 'Santos', 'Oliveira', 'Pereira', 'Ferreira', 'Rodrigues', 'Almeida', 'Costa', 'Carvalho', 'Gomes'
];

// List of domains
const domains = [
  'vimeo.com', 'adobe.com', 'blackmagicdesign.com', 'avid.com',
  'finalcutpro.com', 'davinciresolve.com', 'wondershare.com', 'magix.com',
  'vegascreativesoftware.com', 'cyberlink.com', 'corel.com', 'movavi.com',
  'techsmith.com', 'telestream.net', 'nvidia.com', 'encoding.com', 'ffmpeg.org',
  'openshot.org', 'shotcut.org', 'kdenlive.org', 'lightworks.com', 'nchsoftware.com',
  'videolan.org', 'avidemux.org', 'opencoloriosystem.com', 'handbrake.fr',
  'mltframework.org', 'blender.org', 'obs-studio.org', 'streamlabs.com',
  'restream.io', 'wowza.com', 'panopto.com', 'sproutvideo.com',
  'vidyard.com', 'brightcove.com', 'jwplayer.com', 'vevo.com',
  'dailymotion.com', 'facebook.com', 'instagram.com',
  'snapchat.com', 'linkedin.com', 'pinterest.com'
];

let randomDomain = getRandomElement(domains);

// Function to get a random element from an array
function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// Function to generate a random password
function generateRandomPassword(length = 16) {
  const charset = "a-zA-Z0-9!@#$%^&*()_+";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }
  return password;
}

// Function to generate a random US phone number
function generateUSPhoneNumber() {
  const areaCode = Math.floor(Math.random() * 800) + 200;
  const firstPart = Math.floor(Math.random() * 900) + 100;
  const secondPart = Math.floor(Math.random() * 9000) + 1000;
  return `+1 ${areaCode} ${firstPart} ${secondPart}`;
}

test('Dacast free trial test', async ({ page }) => {
  const host = process.env._HOST;
  test.setTimeout(180000); // Increase the overall test timeout to 3 minutes

  console.log('Starting test');

  await test.step('Navigate to Free Trial page', async () => {
    try {
      await page.goto(`https://www.${host}/signup?autotest=true`, { 
        waitUntil: 'domcontentloaded', 
        timeout: 120000 
      });
      console.log('Page loaded successfully');
    } catch (error) {
      console.error('Error loading page:', error);
      throw error;
    }
    await page.waitForTimeout(1000);
  });


  await page.goto(`https://www.${host}/signup?autotest=true`);
  await page.waitForTimeout(5000);

  await test.step('Fill out the Free Trial form', async () => {
    console.log('Filling out the form');

    await page.getByLabel('Email').click();
    await page.getByLabel('Email').fill(`yk_${Array(6).fill().map(() => Math.random() < 0.5 ? String.fromCharCode(97 + Math.floor(Math.random() * 26)) : Math.floor(Math.random() * 10)).join('')}@${randomDomain}`);
    

    // Select a random first name and last name
    const firstName = getRandomElement(firstNames);
    const lastName = getRandomElement(lastNames);

    console.log(`Using name: ${firstName} ${lastName}`);

    await page.getByLabel('First Name').click();
    for (const char of firstName) {
      await page.keyboard.type(char, { delay: Math.floor(Math.random() * (250 - 50 + 1)) + 50 });
    }
    await page.getByLabel('First Name').press('Tab');

    for (const char of lastName) {
      await page.keyboard.type(char, { delay: Math.floor(Math.random() * (250 - 50 + 1)) + 50 });
    }
    
    await page.getByLabel('Last Name').press('Tab');
    // Generate a random US phone number
    const phoneNumber = generateUSPhoneNumber();
    console.log(`Using phone number: ${phoneNumber}`);

    await page.getByLabel('Phone Number').click();
    for (const char of phoneNumber) {
      await page.keyboard.type(char, { delay: Math.floor(Math.random() * (250 - 50 + 1)) + 50 });
    }
    await page.getByLabel('Phone Number').press('Tab');
    await page.getByLabel('Company URL').click();
    await page.getByLabel('Company URL').fill('');
    
    console.log(`Using domain: ${randomDomain}`);
    for (const char of `https://${randomDomain}`) {
      await page.keyboard.type(char, { delay: Math.floor(Math.random() * (250 - 50 + 1)) + 50 });
    }
    await page.getByLabel('Company URL').press('Tab');
    
    // Generate a random password
    const randomPassword = generateRandomPassword();
    console.log(`Using password: ${randomPassword}`);

    await page.getByLabel('Password').click();
    for (const char of randomPassword) {
      await page.keyboard.type(char, { delay: Math.floor(Math.random() * (250 - 50 + 1)) + 50 });
    }
    
    console.log('Form filled out');

    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: 'Sign up free' }).click();
    console.log('Signup button clicked');

    // Waiting for the reCaptcha by-pass way implemented

  });
  await page.waitForTimeout(5000);
  await test.step('Validate Dashboard', async () => {
    try {
      await expect(page.getByText(/Welcome, .+!/)).toBeVisible({ timeout: 20000 });
      console.log('Woclome message is visible');
    } catch (error) {
      console.error('Test did not complete: Welcome is not visible');
      test.fail();
      testFailed = true;
    }
  });

  console.log('Test completed');
});
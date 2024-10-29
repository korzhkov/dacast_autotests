require('dotenv').config(); // Должно быть в самом начале файла
const axios = require('axios');

const SLACK_TOKEN = process.env._SLACK_TOKEN; // Токен берется из .env
const SLACK_URL = 'https://slack.com/api/chat.postMessage';
const SLACK_CHANNEL = process.platform === 'win32' ? '#ysk_test' : '#slack-messages-test';

async function sendToSlack(message, testName, type = 'info') {
  const username = type === 'error' ? 'Test Error Bot' : 'Test Info Bot';
  const formattedMessage = formatMessage(message, testName, type);

  const payload = {
    token: SLACK_TOKEN,
    channel: SLACK_CHANNEL,
    text: formattedMessage,
    username: username,
  };

  console.log(`Sending ${type} message to Slack`);

  try {
    const response = await axios.post(SLACK_URL, new URLSearchParams(payload), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    console.log('Response from Slack:', response.data);
  } catch (error) {
    console.error('Error sending message to Slack:', error);
  }
}

function formatMessage(message, testName, type) {
  const emoji = type === 'error' ? ':x:' : ':information_source:';
  const header = type === 'error' ? 'Test Failed' : 'Test Info';
  
  let formattedMessage = `
${emoji} *${header}: ${testName}*
${message}
  `.trim();

  if (type === 'error' && message instanceof Error) {
    formattedMessage += `
Error Message: ${message.message}
Stack Trace:
\`\`\`
${message.stack}
\`\`\`
    `.trim();
  }

  return formattedMessage;
}

module.exports = { sendToSlack };
require('dotenv').config();
const axios = require('axios');

const SLACK_TOKEN = process.env._SLACK_TOKEN;
const SLACK_URL = 'https://slack.com/api/chat.postMessage';
const SLACK_CHANNEL = process.platform === 'win32' ? '#ysk_test' : '#slack-messages-test';

async function sendToSlack(message, testName, type = 'info') {
  const username = type === 'error' ? 'Test Error Bot' : 
                   type === 'warning' ? 'Test Warning Bot' : 'Test Info Bot';
  const env = (process.env.WORKENV || 'prod').toUpperCase();
  const formattedMessage = formatMessage(message, testName, type, env);

  const payload = {
    token: SLACK_TOKEN,
    channel: SLACK_CHANNEL,
    text: formattedMessage,
    username: username,
  };

  console.log(`Sending ${type} message to Slack for ${env} environment`);

  try {
    const response = await axios.post(SLACK_URL, new URLSearchParams(payload), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    console.log('Response from Slack:', response.data);
  } catch (error) {
    console.error('Error sending message to Slack:', error);
  }
}

function formatMessage(message, testName, type, env) {
  const emoji = type === 'error' ? ':x:' : 
                type === 'warning' ? ':warning:' : ':information_source:';
  const header = type === 'error' ? 'Test Failed' : 
                 type === 'warning' ? 'Test Flaky' : 'Test Info';
  
  let formattedMessage = `
${emoji} *${header}: ${testName}* [${env}]
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
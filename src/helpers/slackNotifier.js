require('dotenv').config(); // Должно быть в самом начале файла
const axios = require('axios');

const SLACK_TOKEN = process.env._SLACK_TOKEN; // Токен берется из .env
const SLACK_URL = 'https://slack.com/api/chat.postMessage';

async function sendSlackMessage(channel, username, message) {
  const payload = {
    token: SLACK_TOKEN,
    channel: channel,
    text: message,
    username: username,
  };

  console.log('Sending message with payload:', payload); // Отладочный вывод

  try {
    const response = await axios.post(SLACK_URL, new URLSearchParams(payload), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    console.log('Response from Slack:', response.data); // Отладочный вывод
  } catch (error) {
    console.error('Error sending message to Slack:', error);
  }
}

module.exports = { sendSlackMessage };
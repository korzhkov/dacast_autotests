require('dotenv').config(); // Добавьте это, чтобы убедиться, что переменные окружения загружаются
const { sendSlackMessage } = require('./helpers/slackNotifier');

(async () => {
  const channel = '#ysk_test'; // Замените на ваш канал
  const username = 'TEST';
  const message = 'Test Message';

  await sendSlackMessage(channel, username, message);
})();
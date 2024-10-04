const { mkdirSync } = require('fs');
const { join } = require('path');

module.exports = async () => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const baseResultsDir = join(__dirname, 'test-results', timestamp);
  mkdirSync(baseResultsDir, { recursive: true });
};
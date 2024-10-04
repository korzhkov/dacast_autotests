const { sendToSlack } = require('./slackNotifier');

class CustomReporter {
  constructor() {
    this.testResults = {
      totalTests: 0,
      passed: 0,
      failed: 0,
      skipped: 0
    };
  }

  onTestBegin(test) {
    this.testResults.totalTests++;
  }

  onTestEnd(test, result) {
    if (result.status === 'passed') {
      this.testResults.passed++;
      sendToSlack(`Test passed: ${test.title}`, test.title, 'info');
    } else if (result.status === 'failed') {
      this.testResults.failed++;
      const errorMessage = result.error?.message || 'Unknown error';
      const errorStack = result.error?.stack || 'No stack trace available';
      
      const message = `
Test failed: ${test.title}
Error: ${errorMessage}
Stack trace:
${errorStack}
      `;

      sendToSlack(message, test.title, 'error');
    } else if (result.status === 'skipped') {
      this.testResults.skipped++;
      sendToSlack(`Test skipped: ${test.title}`, test.title, 'info');
    }
  }

  onEnd() {
    const summary = `
Test run completed.
Total: ${this.testResults.totalTests}
Passed: ${this.testResults.passed}
Failed: ${this.testResults.failed}
Skipped: ${this.testResults.skipped}
    `;

    sendToSlack(summary, 'Test Run Summary');
  }
}

module.exports = CustomReporter;
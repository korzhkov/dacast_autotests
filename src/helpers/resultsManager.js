const fs = require('fs');
const path = require('path');
const playwrightConfig = require('../../playwright.config');

/**
 * Class for managing test results storage
 * Creates timestamped directories for each test run and copies Playwright results
 */
class ResultsManager {
  /**
   * Initialize ResultsManager with environment and timestamp
   * Creates path like: results/[env]/[timestamp]
   */
  constructor(config = {}) {
    // Get environment from process.env or default to 'prod'
    this.env = process.env.WORKENV || 'prod';
    
    // Create timestamp string, replacing : with - for valid directory name
    this.timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Construct full path for results directory
    this.resultsDir = path.join(process.cwd(), 'results', this.env, this.timestamp);

    // Get Playwright's results directory from config
    this.outputDir = config.outputDir || 'test-results';
  }

  /**
   * Create results directory if it doesn't exist
   * Directory structure: results/[env]/[timestamp]/
   */
  init() {
    if (!fs.existsSync(this.resultsDir)) {
      // Create directory recursively (creates parent dirs if needed)
      fs.mkdirSync(this.resultsDir, { recursive: true });
      console.log(`Created results directory: ${this.resultsDir}`);
    }
  }

  /**
   * Copy Playwright's results.json and network logs to our timestamped directory
   * Source: [playwright-results-dir]/*.json,*.har
   * Target: results/[env]/[timestamp]/*.json,*.har
   */
  saveResults() {
    try {
      const filesToCopy = ['results.json', 'network-logs.json', 'network-logs.har'];
      
      filesToCopy.forEach(file => {
        const sourcePath = path.join(process.cwd(), this.outputDir, file);
        const targetPath = path.join(this.resultsDir, file);

        if (fs.existsSync(sourcePath)) {
          // Copy file to our directory
          fs.copyFileSync(sourcePath, targetPath);
          console.log(`Copied ${file} to: ${targetPath}`);
        } else {
          console.log(`File ${file} not found in ${this.outputDir}`);
        }
      });
    } catch (error) {
      console.error('Error saving results:', error);
    }
  }
}

module.exports = ResultsManager;
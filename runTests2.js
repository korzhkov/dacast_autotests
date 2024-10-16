const { test } = require('@playwright/test');
const { execSync } = require('child_process');

const testsToRun = ['quick', 'quick2'];
const isSequential = process.argv.includes('--sequential');

async function runTests() {
    console.log(`[${new Date().toISOString()}] Starting test sequence in ${isSequential ? 'sequential' : 'parallel'} mode`);
    
    const testFiles = testsToRun.map(test => `src/${test}.test.js`);
    const workers = isSequential ? '--workers=1' : '';
    
    const command = `npx playwright test ${testFiles.join(' ')} --config=playwright.config.js ${workers}`;
    
    console.log(`[${new Date().toISOString()}] Running command: ${command}`);
    
    try {
        execSync(command, { stdio: 'inherit' });
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error running tests:`, error);
    }
}

console.log(`[${new Date().toISOString()}] Script started`);
runTests().catch(console.error);
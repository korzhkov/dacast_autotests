const { test } = require('@playwright/test');
const { execSync } = require('child_process');

// Простой выбор окружения из аргументов
const validEnvs = ['prod', 'stage', 'dev'];
const env = process.argv.find(arg => validEnvs.includes(arg)) || 'prod';

const testsToRun = ['cleaner', 'quick', 'quick2'];
const isSequential = process.argv.includes('--sequential');

async function runTests() {
    console.log(`[${new Date().toISOString()}] Starting test sequence in ${env.toUpperCase()} environment`);
    
    const testFiles = testsToRun.map(test => `src/${test}.test.js`);
    const workers = isSequential ? '--workers=1' : '';
    
    const command = `npx playwright test ${testFiles.join(' ')} --config=playwright.config.js ${workers}`;
    
    console.log(`[${new Date().toISOString()}] Running command: ${command}`);
    
    try {
        // Передаем env через process.env
        process.env.WORKENV = env;
        execSync(command, { stdio: 'inherit' });
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error running tests:`, error);
    }
}

console.log(`[${new Date().toISOString()}] Script started for ${env.toUpperCase()}`);
runTests().catch(console.error);

#!/bin/bash

# Configure logging
exec 1> >(tee -a "/home/ec2-user/cron_tests.log") 2>&1

echo "=== Test run started at $(date) ==="
echo "Current user: $(whoami)"
echo "Current directory before cd: $(pwd)"

# Change to the script directory
cd "$(dirname "$0")"
echo "Changed directory to: $(pwd)"

# Check environment variables
echo "PATH: $PATH"
echo "NODE_PATH: $NODE_PATH"
echo "NVM_DIR: $NVM_DIR"

# Load NVM
echo "Loading NVM..."
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
    echo "Found NVM script, sourcing it..."
    \. "$NVM_DIR/nvm.sh"
else
    echo "ERROR: NVM script not found at $NVM_DIR/nvm.sh"
fi

# Check NVM availability
echo "Checking NVM..."
which nvm || echo "NVM not found in PATH"

# Switch to Node 16
echo "Switching to Node 16..."
nvm use 16 || echo "Failed to switch to Node 16"

# Check Node version
echo "Current Node version: $(node -v || echo 'Node not found')"

# Check xvfb availability
echo "Checking xvfb..."
which xvfb-run || echo "xvfb-run not found"

# Start tests
echo "Starting tests..."
xvfb-run node runTests2.js prod --sequential

echo "=== Test run finished at $(date) ==="